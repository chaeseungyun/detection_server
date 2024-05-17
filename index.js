const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const mysql = require("mysql2");
const admin = require("firebase-admin");

const app = express();
const port = 8080;
require("dotenv").config();

const serviceAccount = require("./detectionapp-9fad2-firebase-adminsdk-n094q-b78e545fa0.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

app.use(bodyParser.json());
app.use(cors());

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER, // MySQL 루트 사용자명
  password: process.env.DB_PASSWORD, // MySQL 루트 비밀번호
  database: process.env.DB_DATABASE,
});

db.connect((err) => {
  if (err) {
    console.error("Error connecting to the database:", err);
    return;
  }
  console.log("Connected to the database");
});

app.get("/", (req, res) => {
  res.send("도로 상태 분석 애플리케이션");
});

// 회원 정보 등록, 회원 가입
app.post("/create-account", (req, res) => {
  const { name, account, password, device_token } = req.body;

  if (!name || !account || !password || !device_token) {
    return res.status(400).send({ message: "모든 값을 입력해주세요." });
  }

  const query =
    "INSERT INTO users (name, account, password, device_token) VALUES (?, ?, ?, ?)";

  db.query(query, [name, account, password, device_token], (err, result) => {
    if (err) {
      console.error("등록 중 에러가 발생했습니다: ", err);
      return res
        .status(500)
        .send({ message: "등록 중 에러가 발생했습니다.", error: err });
    }
    res.status(201).send({
      message: "성공적으로 등록되었습니다.",
      data: { id: result.insertId, name, account, device_token },
    });
  });
});

// 알림 테스트용 코드
app.get("/discover-pothole", (req, res) => {
  db.query("select device_token from users", (err, result) => {
    if (err) {
      console.error("Error fetching device tokens:", err);
      res.status(500).send("Error fetching device tokens");
      return;
    }

    const tokens = result.map((row) => row.device_token);

    const message = {
      notification: {
        title: "포트홀을 발견했습니다!",
        body: "신고하시겠습니까?",
      },
      tokens: tokens,
    };

    admin
      .messaging()
      .sendMulticast(message)
      .then((response) => {
        console.log("Successfully sent message:", response);
        res.send("Data received and notification sent");
      })
      .catch((error) => {
        console.log("Error sending message:", error);
        res.status(500).send("Error sending notification");
      });
  });
});

// 로그인
app.post("/login", (req, res) => {
  const { account, password } = req.body;

  if (!account || !password) {
    return res.status(400).send({ message: "아이디와 비밀번호가 필요합니다." });
  }

  const query = "SELECT id FROM users WHERE account = ? AND password = ?";
  db.query(query, [account, password], (err, results) => {
    if (err) {
      console.error("Error executing query:", err);
      return res.status(500).send("Internal server error");
    }

    if (results.length > 0) {
      const userId = results[0].id;
      res.status(200).send({
        id: userId,
      });
    } else {
      res.status(401).send({ message: "아이디 혹은 비밀번호를 확인해주세요." });
    }
  });
});

// 포트홀 발견 시 데이터를 담아 서버로 전송
app.post("/discover-pothole", (req, res) => {});

// 알림 수신 시 서버에 데이터 저장
app.post("/report", (req, res) => {
  const { user_id, latitude, longitude } = req.body;

  if (!user_id || !latitude || !longitude) {
    return res.status(400).send({ message: "id, 위도, 경도가 필요합니다" });
  }

  const query =
    "INSERT INTO reports (user_id, latitude, longitude) VALUES (?, ?, ?)";
  db.query(
    query,
    [user_id, parseFloat(latitude), parseFloat(longitude)],
    (err, results) => {
      if (err) {
        console.error("Error executing query:", err);
        return res.status(500).send({ message: "internal server error" });
      }

      res.status(200).send({ message: "성공적으로 접수했습니다." });
    }
  );
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
