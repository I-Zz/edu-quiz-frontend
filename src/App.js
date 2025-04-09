import React, { useState, useEffect } from "react";
import { io } from "socket.io-client";

const API_BASE = "http://localhost:3000";

export default function App() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [user, setUser] = useState(null);
  const [token, setToken] = useState("");
  const [socket, setSocket] = useState(null);

  const [roomAction, setRoomAction] = useState(null);
  const [questions, setQuestions] = useState([
    {
      question: "",
      options: ["", "", "", ""],
      correctAnswer: 0,
      timeLimit: 30,
    },
  ]);
  const [roomId, setRoomId] = useState("");

  const [createdRoom, setCreatedRoom] = useState(null);
  const [participants, setParticipants] = useState([]);

  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [intervalId, setIntervalId] = useState(null);
  const [scoreboard, setScoreboard] = useState(null);

  const handleLogin = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setToken(data.access_token);
        fetchUser(email, data.access_token);
        const newSocket = io(API_BASE, {
          extraHeaders: {
            Authorization: `Bearer ${data.access_token}`,
          },
        });
        newSocket.on("connect", () => {
          console.log("Connected to WebSocket Server");
        });
        newSocket.on("roomCreated", (room) => {
          console.log("Room created successfully, room:", room);
          setCreatedRoom(room);
          console.log(room);
          setRoomAction("lobby");
        });
        newSocket.on("joinRoomSuccess", (data) => {
          console.log("Room joined successfully! roomId: ", data.roomId);
        });
        newSocket.on("participantJoined", (participant) => {
          console.log("New Participant joined! userId: ", participant);
          setParticipants((prev) => [...prev, participant]);
        });
        newSocket.on("quizStarted", () => {
          console.log("quizStarted");
        });
        newSocket.on("newQuestion", (question) => {
          console.log("newQuestion: ", question);
          setCurrentQuestion(question);
          setTimeLeft(question.timeLimit);
          setQuestionIndex((prev) => prev + 1);
        });
        newSocket.on("quizEnded", (finalScoreboard) => {
          console.log("quizEnded");
          setCurrentQuestion(null);
          setTimeLeft(0);
          clearInterval(intervalId);
          setScoreboard(finalScoreboard);
        });
        setSocket(newSocket);
      } else {
        alert(data.message || "Login failed");
      }
    } catch {
      alert("Login failed");
    }
  };

  const handleRegister = async () => {
    try {
      const res = await fetch(`${API_BASE}/users/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, displayName }),
      });
      const data = await res.json();
      if (res.ok) {
        alert("Registration successful, please login.");
        setMode("login");
      } else {
        alert(data.message || "Registration failed");
      }
    } catch {
      alert("Registration failed");
    }
  };

  const fetchUser = async (email, token) => {
    try {
      const res = await fetch(`${API_BASE}/users/?email=${email}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data);
      } else {
        alert(data.message || "Failed to fetch user data");
      }
    } catch {
      alert("Failed to fetch user data");
    }
  };

  const handleLogout = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        setToken("");
        setUser(null);
        setSocket(null);
        setRoomAction(null);
        setCreatedRoom(null);
        setParticipants([]);
      } else {
        alert("Logout failed");
      }
    } catch {
      alert("Logout failed");
    }
  };

  const isValidQuestions = () => {
    return questions.every((q) => {
      return (
        q.question.trim() !== "" &&
        q.options.length === 4 &&
        q.options.every((opt) => opt.trim() !== "") &&
        typeof q.correctAnswer === "number" &&
        q.correctAnswer >= 0 &&
        q.correctAnswer <= 3 &&
        typeof q.timeLimit === "number" &&
        q.timeLimit > 0
      );
    });
  };

  const handleCreateRoom = () => {
    if (!isValidQuestions()) {
      alert(
        "Please fill all question fields correctly before creating the room."
      );
      return;
    }
    if (socket) {
      socket.emit("createRoom", { questions });
    }
  };

  const handleJoinRoom = () => {
    if (socket) {
      socket.emit("joinRoom", { roomId });
    }
  };

  const updateQuestion = (index, field, value) => {
    const updated = [...questions];
    if (field === "question") {
      updated[index].question = value;
    } else if (field === "correctAnswer") {
      updated[index].correctAnswer = parseInt(value, 10);
    } else if (field === "timeLimit") {
      updated[index].timeLimit = parseInt(value, 10);
    } else {
      updated[index].options[field] = value;
    }
    setQuestions(updated);
  };

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        question: "",
        options: ["", "", "", ""],
        correctAnswer: 0,
        timeLimit: 30,
      },
    ]);
  };

  const removeQuestion = (index) => {
    const updated = [...questions];
    updated.splice(index, 1);
    setQuestions(updated);
  };

  const startQuiz = () => {
    socket.emit("startQuiz", { roomId: createdRoom._id });
    console.log("quiz started");
  };

  useEffect(() => {
    if (roomAction !== "quiz" || timeLeft <= 0) return;

    const id = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    setIntervalId(id);

    return () => clearInterval(id);
  }, [roomAction, timeLeft]);

  useEffect(() => {
    if (roomAction === "quiz" && timeLeft === 0 && selectedOption==null) {
      clearInterval(intervalId);

      // Auto-submit logic here
      // Example: emit selectedAnswer or null
      socket.emit("submitAnswer", {
        roomId: roomId,
        answerId: -1,
        questionId: questionIndex,
      });
    }
  }, [timeLeft, roomAction]);

  if (user && !roomAction) {
    return (
      <div className="container">
        <div className="card">
          <h2>Welcome, {user.displayName}</h2>
          <p>Email: {user.email}</p>
          <p>userId: {user._id}</p>
          <button onClick={() => setRoomAction("create")}>Create Room</button>
          <button onClick={() => setRoomAction("join")}>Join Room</button>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </div>
    );
  }

  if (roomAction === "create") {
    return (
      <div className="container">
        <div className="card">
          <h2>Welcome, {user.displayName}</h2>
          <p>Email: {user.email}</p>
          <p>userId: {user._id}</p>
        </div>
        <div className="card">
          <h2>Create Room</h2>
          {questions.map((q, i) => (
            <div
              key={i}
              style={{
                marginBottom: "20px",
                border: "1px solid #ccc",
                padding: "10px",
              }}
            >
              <input
                type="text"
                placeholder="Question"
                value={q.question}
                onChange={(e) => updateQuestion(i, "question", e.target.value)}
              />
              {q.options.map((opt, j) => (
                <input
                  key={j}
                  type="text"
                  placeholder={`Option ${j + 1}`}
                  value={opt}
                  onChange={(e) => updateQuestion(i, j, e.target.value)}
                />
              ))}
              <input
                type="number"
                placeholder="Correct Answer (0-3)"
                min="0"
                max="3"
                value={q.correctAnswer}
                onChange={(e) =>
                  updateQuestion(i, "correctAnswer", e.target.value)
                }
              />
              <input
                type="number"
                placeholder="Time Limit (in seconds)"
                min="1"
                value={q.timeLimit}
                onChange={(e) => updateQuestion(i, "timeLimit", e.target.value)}
              />
              <button onClick={() => removeQuestion(i)}>Remove Question</button>
            </div>
          ))}
          <button onClick={addQuestion}>Add Question</button>
          <button onClick={handleCreateRoom}>Create Room</button>
          <button onClick={() => setRoomAction(null)}>Back</button>
        </div>
      </div>
    );
  }

  if (roomAction === "lobby") {
    return (
      <div className="container">
        <div className="card">
          <h2>Welcome, {user.displayName}</h2>
          <p>Email: {user.email}</p>
          <p>userId: {user._id}</p>
        </div>
        <div className="card">
          <h2>Room Lobby</h2>
          <h3>Room ID: {createdRoom?._id || "N/A"}</h3>
          <h4>Participants:</h4>
          <ul>
            {participants.map((p, idx) => (
              <li key={idx}>{p.displayName || p.email || p.userId}</li>
            ))}
          </ul>
          <h4>Questions:</h4>
          {createdRoom?.questions.map((q, i) => (
            <div key={i}>
              <strong>
                Q{i + 1}: {q.question}
              </strong>
            </div>
          ))}
          if (currentQuestion){" "}
          {
            <div className="container">
              <div className="card">
                <h2>Question {questionIndex}</h2>
                <p>{currentQuestion.question}</p>
                <ul>
                  {currentQuestion.options.map((opt, i) => (
                    <li key={i}>{opt}</li>
                  ))}
                </ul>
                <p>Time Left: {timeLeft}s</p>
                {/* You can add an option selector & submit button here */}
              </div>
            </div>
          }{" "}
          else {<button onClick={startQuiz}>Start Quiz</button>}
        </div>
      </div>
    );
  }

  if (roomAction === "join") {
    return (
      <div className="container">
        <div className="card">
          <h2>Welcome, {user.displayName}</h2>
          <p>Email: {user.email}</p>
          <p>userId: {user._id}</p>
        </div>
        <div className="card">
          <h2>Join Room</h2>
          <input
            type="text"
            placeholder="Enter Room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />
          <button onClick={handleJoinRoom}>Join</button>
          <button onClick={() => setRoomAction(null)}>Back</button>
        </div>
      </div>
    );
  }

  if (roomAction === "quiz") {
    return (
      <div className="container">
        <div className="card">
          <h2>Question {questionIndex}</h2>
          <p>{currentQuestion.question}</p>
          <ul>
            {currentQuestion.options.map((opt, i) => (
              <li key={i}>{opt}</li>
            ))}
          </ul>
          <p>Time Left: {timeLeft}s</p>
          {/* You can add an option selector & submit button here */}
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card">
        <h2>{mode === "login" ? "Login" : "Register"}</h2>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {mode === "register" && (
          <input
            type="text"
            placeholder="Display Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        )}
        <button onClick={mode === "login" ? handleLogin : handleRegister}>
          {mode === "login" ? "Login" : "Register"}
        </button>
        <p>
          {mode === "login" ? (
            <>
              Don't have an account?{" "}
              <button className="link" onClick={() => setMode("register")}>
                Register
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button className="link" onClick={() => setMode("login")}>
                Login
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
