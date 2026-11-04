import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const API_URL =
  import.meta.env.VITE_SOCKET_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000";

export default function BoardRealtime({
  token,
  tenantId,
  boardId,
  onBoardChanged,
}) {
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [connectionError, setConnectionError] = useState("");

  const onBoardChangedRef = useRef(onBoardChanged);

  useEffect(() => {
    onBoardChangedRef.current = onBoardChanged;
  }, [onBoardChanged]);

  useEffect(() => {
    if (!token || !tenantId || !boardId) {
      return;
    }

    const socket = io(API_URL, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      setConnected(true);
      setConnectionError("");

      socket.emit(
        "board:join",
        { tenantId, boardId },
        (response) => {
          if (!response?.success) {
            setConnectionError(
              response?.message || "Unable to join board"
            );
            setOnlineUsers(0);
            return;
          }

          setConnectionError("");

         
          onBoardChangedRef.current?.();
        }
      );
    });

    socket.on("board:presence", (data) => {
      if (
        data?.tenantId &&
        data.tenantId !== tenantId
      ) {
        return;
      }

      if (
        data?.boardId &&
        data.boardId !== boardId
      ) {
        return;
      }

      setOnlineUsers(
        Number.isFinite(data?.onlineUsers)
          ? data.onlineUsers
          : 0
      );
    });

    socket.on("board:changed", (data) => {
      if (
        data?.tenantId === tenantId &&
        data?.boardId === boardId
      ) {
        onBoardChangedRef.current?.();
      }
    });

    socket.on("connect_error", (error) => {
      setConnected(false);
      setOnlineUsers(0);
      setConnectionError(
        error.message || "Connection failed"
      );
    });

    socket.on("disconnect", () => {
      setConnected(false);
      setOnlineUsers(0);
    });

    return () => {
      socket.disconnect();
    };
  }, [token, tenantId, boardId]);

  const isLive = connected && !connectionError;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "9px",
        fontSize: "13px",
        color: "#666",
        marginTop: "12px",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: isLive ? "#16a34a" : "#999",
          flexShrink: 0,
        }}
      />

      <span>
        {connectionError
          ? connectionError
          : isLive
            ? `Live collaboration · ${onlineUsers} online`
            : "Connecting..."}
      </span>
    </div>
  );
}
