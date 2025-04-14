"use client"

import { useState, useEffect } from "react"
import { io } from "socket.io-client"
import "./App.css"

// const API_BASE = "http://localhost:3000"
// const API_BASE = "https://edu-quiz-backend.onrender.com";
const API_BASE = process.env.REACT_APP_API_BASE;

export default function App() {
  const [mode, setMode] = useState("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [user, setUser] = useState(null)
  const [token, setToken] = useState("")
  const [socket, setSocket] = useState(null)

  const [roomAction, setRoomAction] = useState(null)
  const [questions, setQuestions] = useState([
    {
      question: "",
      options: ["", "", "", ""],
      correctAnswer: 0,
      timeLimit: 15,
    },
  ])
  const [roomId, setRoomId] = useState("")

  const [prompt, setPrompt] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [questionCount, setQuestionCount] = useState(5);
  const [loading, setLoading] = useState(false);

  const [createdRoom, setCreatedRoom] = useState(null)
  const [participants, setParticipants] = useState([])

  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [timeLeft, setTimeLeft] = useState(0)
  const [intervalId, setIntervalId] = useState(null)
  const [scoreboard, setScoreboard] = useState(null)
  const [selectedOption, setSelectedOption] = useState(null)

  const handleLogin = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (res.ok) {
        setToken(data.access_token)
        fetchUser(email, data.access_token)
        const newSocket = io(API_BASE, {
          extraHeaders: {
            Authorization: `Bearer ${data.access_token}`,
          },
        })
        newSocket.on("connect", () => {
          console.log("Connected to WebSocket Server")
        })
        newSocket.on("roomCreated", (room) => {
          console.log("Room created successfully, room:", room)
          setCreatedRoom(room)
          console.log(room)
          setRoomAction("lobby")
        })
        newSocket.on("joinRoomSuccess", (data) => {
          console.log("Room joined successfully! roomId: ", data.roomId)
          setRoomId(data.roomId)
          setRoomAction("joined")
        })
        newSocket.on("participantJoined", (participant) => {
          console.log("New Participant joined! userId: ", participant)
          setParticipants((prev) => [...prev, participant])
        })
        newSocket.on("quizStarted", () => {
          console.log("quizStarted")
          if (roomAction === "lobby") return
          setRoomAction("quiz")
        })
        newSocket.on("newQuestion", (question) => {
          console.log("newQuestion: ", question)
          setCurrentQuestion(question)
          setTimeLeft(question.timeLimit)
          setQuestionIndex((prev) => prev + 1)
          setSelectedOption(null)
        })
        newSocket.on("quizEnded", (finalScoreboard) => {
          console.log("quizEnded")
          setCurrentQuestion(null)
          setTimeLeft(0)
          clearInterval(intervalId)
          setScoreboard(finalScoreboard.scoreboard)
          setRoomAction("scoreboard")
          console.log("finalScoreboard:", finalScoreboard)
        })
        setSocket(newSocket)
        setLoading(false)
      } else {
        alert(data.message || "Login failed")
        setLoading(false)
      }
    } catch {
      alert("Login failed")
    }
  }

  const handleRegister = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/users/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, displayName }),
      })
      const data = await res.json()
      if (res.ok) {
        alert("Registration successful, please login.")
        setMode("login")
        setLoading(false)
      } else {
        alert(data.message || "Registration failed")
        setLoading(false)
      }
    } catch {
      alert("Registration failed")
    }
  }

  const fetchUser = async (email, token) => {
    try {
      const res = await fetch(`${API_BASE}/users/?email=${email}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const data = await res.json()
      if (res.ok) {
        setUser(data)
      } else {
        alert(data.message || "Failed to fetch user data")
      }
    } catch {
      alert("Failed to fetch user data")
    }
  }

  const handleLogout = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (res.ok) {
        setToken("")
        setUser(null)
        setSocket(null)
        setRoomAction(null)
        setCreatedRoom(null)
        setParticipants([])
      } else {
        alert("Logout failed")
      }
    } catch {
      alert("Logout failed")
    }
  }

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
      )
    })
  }

  const handleCreateRoom = () => {
    if (!isValidQuestions()) {
      alert("Please fill all question fields correctly before creating the room.")
      return
    }
    if (socket) {
      socket.emit("createRoom", { questions })
    }
  }

  const handleJoinRoom = () => {
    if (socket) {
      socket.emit("joinRoom", { roomId })
    }
  }

  const updateQuestion = (index, field, value) => {
    const updated = [...questions]
    if (field === "question") {
      updated[index].question = value
    } else if (field === "correctAnswer") {
      updated[index].correctAnswer = Number.parseInt(value, 10)
    } else if (field === "timeLimit") {
      updated[index].timeLimit = Number.parseInt(value, 10)
    } else {
      updated[index].options[field] = value
    }
    setQuestions(updated)
  }

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        question: "",
        options: ["", "", "", ""],
        correctAnswer: 0,
        timeLimit: 15,
      },
    ])
  }

  const removeQuestion = (index) => {
    const updated = [...questions];
    updated.splice(index, 1);
    setQuestions(updated);
  };

  const generateQuestions = async (
    prompt,
    count = 5,
    difficulty = "medium"
  ) => {
    setLoading(true);
    try {
      socket.emit(
        "generateQuestions",
        {
          prompt: prompt,
          difficulty: difficulty,
          count: count,
        },
        (response) => {
          if (response.success) {
            console.log("response Questions:", response.questions);
            setQuestions(response.questions);
          } else {
            console.error("Error:", response.error);
          }
          setLoading(false);
        }
      );
    } catch (error) {
      console.error("Error generating questions:", error);
      alert("Failed to generate questions. Check the API key or prompt.");
    }
  };

  const startQuiz = () => {
    socket.emit("startQuiz", { roomId: createdRoom._id })
    console.log("quiz started")
  }

  useEffect(() => {
    if ((roomAction === "quiz" || roomAction === "lobby") && timeLeft > 0) {
      console.log("timeLeft:", timeLeft)
      const id = setInterval(() => {
        setTimeLeft((prev) => prev - 1)
      }, 1000)
      setIntervalId(id)

      return () => clearInterval(id)
    }
  }, [roomAction, timeLeft])

  const submitAnswer = (selectedOption) => {
    setSelectedOption(selectedOption)
    console.log("submitAnswer:: roomId:", roomId, "questionIndex:", questionIndex, "selectedOption:", selectedOption)
    socket.emit("submitAnswer", {
      roomId: roomId,
      answerId: selectedOption,
      questionId: currentQuestion._id,
    })
  }

  // Header component
  const Header = () => (
    <header className="app-header">
      <h1 className="app-title">EduQuiz</h1>
      {user && (
        <div className="flex items-center gap-2">
          <span>Your Email: {user.email}</span>
          {roomAction && (
            <button className="btn btn-secondary" onClick={() => setRoomAction(null)}>
              Back
            </button>
          )}
          <button className="btn btn-danger" onClick={handleLogout}>
            Logout
          </button>
        </div>
      )}
    </header>
  )

  // Auth screen
  if (!user) {
    return (
      <div className="container">
        <Header />
        <div className="card">
          <h2 className="card-title">{mode === "login" ? "Login to EduQuiz" : "Create an Account"}</h2>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {mode === "register" && (
            <div className="form-group">
              <label className="form-label">Display Name</label>
              <input
                type="text"
                placeholder="How should we call you?"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
          )}
          <button className="btn btn-block" onClick={loading ? "loading..." : mode === "login" ? handleLogin : handleRegister}>
            {loading ? "loading..." : mode === "login" ? "Login" : "Register"}
          </button>
          <p className="text-center">
            {mode === "login" ? (
              <>
                Don't have an account?{" "}
                <button className="btn-link" onClick={() => setMode("register")}>
                  Register
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button className="btn-link" onClick={() => setMode("login")}>
                  Login
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    )
  }

  // Dashboard screen
  if (user && !roomAction) {
    return (
      <div className="container">
        <Header />
        <div className="card">
          <h2 className="card-title">Welcome to EduQuiz</h2>
          <p className="text-center">What would you like to do today?</p>
          <div className="flex flex-col items-center">
            <button className="btn btn-block" onClick={() => setRoomAction("create")}>
              Create a Quiz Room
            </button>
            <button className="btn btn-block btn-secondary" onClick={() => setRoomAction("join")}>
              Join a Quiz Room
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (roomAction === "create") {
    return (
      <>
        <div className="container">
          <Header />
          <div className="card">
            <h2 className="card-title">Create Quiz Room</h2>
            <p className="text-center mb-0">Add questions for your quiz</p>
            <label>Prompt:</label>
            <textarea
              rows="4"
              cols="50"
              placeholder="Enter topic or prompt for generating questions"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
  
            <label>Difficulty:</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
  
            <label>Number of Questions:</label>
            <input
              type="number"
              min="1"
              value={questionCount}
              onChange={(e) =>
                setQuestionCount(Math.max(1, parseInt(e.target.value) || 1))
              }
            />
  
            <button className="btn"
              onClick={
                loading
                  ? null
                  : () => generateQuestions(prompt, questionCount, difficulty)
              }
            >
              {loading ? "Generating..." : "Generate Questions"}
            </button>
          </div>
  
          {questions.map((q, i) => (
            <div key={i} className="question-card">
              <div className="question-header">
                <span className="question-number">Question {i + 1}</span>
                <button
                  className="btn btn-danger"
                  onClick={() => removeQuestion(i)}
                  disabled={questions.length === 1}
                >
                  Remove
                </button>
              </div>
  
              <div className="form-group">
                <label className="form-label">Question</label>
                <textarea
                  rows="4"
                  type="text"
                  placeholder="Enter your question"
                  value={q.question}
                  onChange={(e) =>
                    updateQuestion(i, "question", e.target.value)
                  }
                />
              </div>
  
              {q.options.map((opt, j) => (
                <div key={j} className="form-group">
                  <label className="form-label">Option {j + 1}</label>
                  <input
                    type="text"
                    placeholder={`Enter option ${j + 1}`}
                    value={opt}
                    onChange={(e) => updateQuestion(i, j, e.target.value)}
                  />
                </div>
              ))}
  
              <div className="flex justify-between">
                <div className="form-group" style={{ width: "48%" }}>
                  <label className="form-label">Correct Answer</label>
                  <select
                    value={q.correctAnswer}
                    onChange={(e) =>
                      updateQuestion(i, "correctAnswer", e.target.value)
                    }
                  >
                    <option value={0}>Option 1</option>
                    <option value={1}>Option 2</option>
                    <option value={2}>Option 3</option>
                    <option value={3}>Option 4</option>
                  </select>
                </div>
  
                <div className="form-group" style={{ width: "48%" }}>
                  <label className="form-label">Time Limit (seconds)</label>
                  <input
                    type="number"
                    min="5"
                    max="120"
                    value={q.timeLimit}
                    onChange={(e) =>
                      updateQuestion(i, "timeLimit", e.target.value)
                    }
                  />
                </div>
              </div>
            </div>
          ))}
  
          <div className="flex justify-between">
            <button className="btn" onClick={addQuestion}>
              Add Question
            </button>
            <button className="btn btn-success" onClick={handleCreateRoom}>
              Create Room
            </button>
          </div>
        </div>
      </>
    );
  }
  

  // Lobby screen
  if (roomAction === "lobby") {
    return (
      <div className="container">
        <Header />
        <div className="card">
          <h2 className="card-title">Quiz Room Lobby</h2>
          <div className="form-group">
            <label className="form-label">Room ID</label>
            <input type="text" value={createdRoom?._id || ""} readOnly onClick={(e) => e.target.select()} />
            <p className="text-center">Share this ID with participants to join your quiz</p>
          </div>

          <div className="form-group">
            <h3 className="card-subtitle">Participants ({participants.length})</h3>
            {participants.length > 0 ? (
              <ul className="scoreboard-list">
                {participants.map((p, idx) => (
                  <li key={idx} className="scoreboard-item">
                    <span>{p.displayName || p.email || p.userId}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-center">Waiting for participants to join...</p>
            )}
          </div>

          <div className="form-group">
            <h3 className="card-subtitle">Questions ({createdRoom?.questions.length || 0})</h3>
            {createdRoom?.questions.map((q, i) => (
              <div key={i} className="question-card">
                <strong>
                  Question {i + 1}: {q.question}
                </strong>
                <ul>
                  {q.options.map((op, j) => (
                    <li key={j} style={{ color: j === q.correctAnswer ? "#48bb78" : "inherit" }}>
                      {op} {j === q.correctAnswer && "✓"}
                    </li>
                  ))}
                </ul>
                <p>Time limit: {q.timeLimit} seconds</p>
              </div>
            ))}
          </div>

          {currentQuestion ? (
            <div className="question-card">
              <h3 className="card-subtitle">Current Question</h3>
              <p>{currentQuestion.question}</p>
              <ul>
                {currentQuestion.options.map((opt, i) => (
                  <li key={i}>{opt}</li>
                ))}
              </ul>
              <div className="timer">Time Left: {timeLeft}s</div>
            </div>
          ) : (
            <button className="btn btn-success btn-block" onClick={startQuiz} disabled={participants.length === 0}>
              Start Quiz
            </button>
          )}
        </div>
      </div>
    )
  }

  if (roomAction == "joined")
    return (
      <div className="container">
        <Header />
        <div className="card">
          <h2 className="card-title">Quiz Room Lobby</h2>
          <div className="form-group">
            <label className="form-label">Room ID</label>
            <input type="text" value={roomId || ""} readOnly onClick={(e) => e.target.select()} />
            <p className="text-center">Waiting for the host to start the quiz...</p>
          </div>
        </div>
      </div>
    );

  if (roomAction === "join") {
    return (
      <div className="container">
        <Header />
        <div className="card">
          <h2 className="card-title">Join Quiz Room</h2>
          <div className="form-group">
            <label className="form-label">Room ID</label>
            <input
              type="text"
              placeholder="Enter the Room ID"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
            />
          </div>
          <button className="btn btn-block" onClick={handleJoinRoom}>
            Join Room
          </button>
        </div>
      </div>
    )
  }

  // Quiz screen
  if (roomAction === "quiz") {
    if (!currentQuestion) {
      return (
        <div className="container">
          <Header />
          <div className="card">
            <h2 className="card-title">Waiting for Quiz to Start</h2>
            <p className="text-center">The host will start the quiz soon...</p>
          </div>
        </div>
      )
    }

    const getTimerClass = () => {
      if (timeLeft <= 5) return "timer danger"
      if (timeLeft <= 10) return "timer warning"
      return "timer"
    }

    return (
      <div className="container">
        <Header />
        <div className="card">
          <h2 className="card-title">Question {questionIndex}</h2>
          <div className={getTimerClass()}>Time Left: {timeLeft}s</div>

          <p className="question-text">{currentQuestion.question}</p>

          <ul className="options-list">
            {currentQuestion.options.map((opt, i) => (
              <li key={i} className="option-item">
                <button
                  className={`option-btn ${selectedOption === i ? "selected" : ""}`}
                  onClick={() => submitAnswer(i)}
                  disabled={selectedOption !== null}
                >
                  {opt}
                </button>
              </li>
            ))}
          </ul>

          {selectedOption !== null && <p className="text-center">Your answer has been submitted!</p>}
        </div>
      </div>
    )
  }

  // Scoreboard screen
  if (roomAction === "scoreboard") {
    if (!scoreboard) {
      return (
        <div className="container">
          <Header />
          <div className="card">
            <h2 className="card-title">Calculating Results</h2>
            <p className="text-center">Please wait while we calculate the final scores...</p>
          </div>
        </div>
      )
    }

    const sortedScoreboard = [...scoreboard].sort((a, b) => b.score - a.score)

    return (
      <div className="container">
        <Header />
        <div className="card scoreboard">
          <h2 className="card-title">Quiz Results</h2>
          <h3 className="card-subtitle">Final Scoreboard</h3>

          <ul className="scoreboard-list">
            {sortedScoreboard.map((entry, i) => (
              <li key={i} className="scoreboard-item">
                <span className="scoreboard-rank">#{i + 1}</span>
                {/* <span className="scoreboard-user">{entry.userId}</span> */}
                <span className="scoreboard-user">{entry.email}</span>
                <span className="scoreboard-score">{entry.score} pts</span>
              </li>
            ))}
          </ul>

          <button className="btn btn-block" onClick={() => setRoomAction(null)}>
            Return to Dashboard
          </button>
        </div>
      </div>
    )
  }

  // This should never happen, but just in case
  return (
    <div className="container">
      <Header />
      <div className="card">
        <h2 className="card-title">Something went wrong</h2>
        <p className="text-center">Please try refreshing the page</p>
        <button className="btn btn-block" onClick={() => window.location.reload()}>
          Refresh
        </button>
      </div>
    </div>
  )
}
