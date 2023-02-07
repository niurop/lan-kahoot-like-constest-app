const fs = require("fs");
const express = require("express");
const bodyParser = require("body-parser");

const app = express();

let reqId = 0;

app.all("*", function (req, res, next) {
  console.log("REQUEST:", reqId++);
  next();
});

app.use(express.static("public"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

const GameState = JSON.parse(
  fs.readFileSync("gameConfig.json", {
    encoding: "utf8",
  })
);

GameState.questions.forEach((q) => {
  const rand = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
  q.A = q.answers[rand[0]];
  q.B = q.answers[rand[1]];
  q.C = q.answers[rand[2]];
  q.D = q.answers[rand[3]];
  delete q.answers;
  q.answer = ["A", "B", "C", "D"][rand.indexOf(0)];
});

GameState.points = {};

app.get("/game-config", function (req, res) {
  res.json({
    title: GameState.title,
    instructions: GameState.instructions,
    login: GameState.login,
    gameState: GameState.gameState,
  });
});

let random_index = Date.now();
const pending_new_players = {};
const pending_new_admins = {};

const players = {};
const admins = {};
const presentations = {};

app.post("/player/register-name", function (req, res) {
  const name = req.body.name;
  if (GameState.gameState === -1) {
    if (
      name === undefined ||
      Object.values(pending_new_players).includes(name) ||
      Object.values(players)
        .map((p) => p.name)
        .includes(name)
    ) {
      res.json(false);
    } else {
      pending_new_players[random_index] = name;
      res.json(random_index++);
    }
  } else {
    if (
      name === undefined ||
      Object.values(pending_new_players).includes(name) ||
      !Object.values(players)
        .map((p) => p.name)
        .includes(name) ||
      Object.values(players).filter((p) => p.name === name)[0].active
    ) {
      res.json(false);
    } else {
      const id = Object.values(players).filter((p) => p.name === name)[0].id;
      pending_new_players[id] = name;
      res.json(id);
    }
  }
});

function broadcast_data(toPlayers, toPresentations, toAdmins, data) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  if (toPlayers) for (const e in players) players[e].res.write(msg);
  if (toAdmins) for (const e in admins) admins[e].res.write(msg);
  if (toPresentations)
    for (const e in presentations) presentations[e].res.write(msg);
}

app.get("/player/subscribe", function (req, res) {
  const id = req.query.id;
  if (id === undefined || !(id in pending_new_players)) return res.end();

  res
    .writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    })
    .write("data: true\n\n");

  const name = pending_new_players[id];
  delete pending_new_players[id];

  const player = { id, name, res, active: true };

  broadcast_data(true, true, true, { type: "newPlayers", players: [{ name }] });

  res.write(
    `data: ${JSON.stringify({
      type: "newPlayers",
      players: Object.values(players).map((p) => ({ name: p.name })),
    })}\n\n`
  );

  players[id] = player;

  console.log("SERVER", `User ${name} connected`);

  req.on("close", () => {
    if (GameState.gameState === -1) delete players[id];
    else {
      players[id].res = { write: () => {} };
      players[id].active = false;
    }
    broadcast_data(true, true, true, {
      type: "removePlayers",
      players: [{ name }],
    });

    console.log("SERVER", `User ${name} disconnected`);
  });

  const state = GameState.gameState;

  if (state >= 0) {
    const id = GameState.questionId;
    const totalQuestions = GameState.questions.length;
    const question = GameState.questions[id].question;
    res.write(
      `data: ${JSON.stringify({
        type: "showQuestion",
        question,
        id,
        totalQuestions,
      })}\n\n`
    );
  }

  if (state >= 1) {
    const id = GameState.questionId;
    const A = GameState.questions[id].A;
    const B = GameState.questions[id].B;
    const C = GameState.questions[id].C;
    const D = GameState.questions[id].D;
    res.write(
      `data: ${JSON.stringify({
        type: "showAnswers",
        A,
        B,
        C,
        D,
      })}\n\n`
    );
  }

  if (state >= 2) {
    const rightAnswer = GameState.questions[GameState.questionId].answer;
    const answers = GameState.answers;

    const scored = name in GameState.scored ? GameState.scored[name] : 0;
    res.write(
      `data: ${JSON.stringify({
        type: "showVotes",
        score: GameState.points[name],
        scored,
        answers,
        rightAnswer,
      })}\n\n`
    );
  }

  if (state >= 10) {
    res.write(
      `data: ${JSON.stringify({
        type: "gameEnded",
      })}\n\n`
    );
  }

  if (state === 20) {
    res.write(
      `data: ${JSON.stringify({
        type: "showResults",
        results: GameState.results,
      })}\n\n`
    );
  }
});

app.post("/admin/register", function (req, res) {
  const password = req.body.password;
  if (password !== GameState.admin_password) {
    res.json(false);
  } else {
    pending_new_admins[random_index] = true;
    res.json(random_index++);
  }
});

app.get("/admin/subscribe", function (req, res) {
  const id = req.query.id;
  if (id === undefined || !(id in pending_new_admins)) return res.end();
  delete pending_new_admins[id];

  res
    .writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    })
    .write("data: true\n\n");

  res.write(
    `data: ${JSON.stringify({
      type: "initialStateUpdate",
      GameState,
    })}\n\n`
  );

  res.write(
    `data: ${JSON.stringify({
      type: "newPlayers",
      players: Object.values(players).map((p) => ({ name: p.name })),
    })}\n\n`
  );

  const admin = { id, name: "admin", res };
  admins[id] = admin;

  console.log("SERVER", `New admin ${id} connected`);

  req.on("close", () => {
    delete admins[id];
    console.log("SERVER", `Admin ${id} disconnected`);
  });

  const state = GameState.gameState;

  if (state >= 0) {
    const id = GameState.questionId;
    const totalQuestions = GameState.questions.length;
    const question = GameState.questions[id].question;
    res.write(
      `data: ${JSON.stringify({
        type: "showQuestion",
        question,
        id,
        totalQuestions,
      })}\n\n`
    );
  }

  if (state >= 1) {
    const id = GameState.questionId;
    const A = GameState.questions[id].A;
    const B = GameState.questions[id].B;
    const C = GameState.questions[id].C;
    const D = GameState.questions[id].D;
    res.write(
      `data: ${JSON.stringify({
        type: "showAnswers",
        A,
        B,
        C,
        D,
      })}\n\n`
    );
    res.write(
      `data: ${JSON.stringify({
        type: "rightAnswer",
        answer: GameState.questions[GameState.questionId].answer,
      })}\n\n`
    );
  }

  if (state >= 2) {
    const rightAnswer = GameState.questions[GameState.questionId].answer;
    const answers = GameState.answers;

    res.write(
      `data: ${JSON.stringify({
        type: "showVotes",
        answers,
        rightAnswer,
      })}\n\n`
    );
  }

  if (state >= 10) {
    res.write(
      `data: ${JSON.stringify({
        type: "gameEnded",
      })}\n\n`
    );

    res.write(
      `data: ${JSON.stringify({
        type: "results",
        results: GameState.results,
      })}\n\n`
    );
  }

  if (state === 20) {
    res.write(
      `data: ${JSON.stringify({
        type: "showResults",
        results: GameState.results,
      })}\n\n`
    );
  }
});

app.get("/presentation/subscribe", function (req, res) {
  const id = random_index++;

  res
    .writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    })
    .write("data: true\n\n");

  res.write(
    `data: ${JSON.stringify({
      type: "newPlayers",
      players: Object.values(players).map((p) => {
        return { name: p.name };
      }),
    })}\n\n`
  );

  presentations[id] = { id, name: "presentation", res };

  console.log("SERVER", `New presentation ${id} connected`);

  req.on("close", () => {
    delete presentations[id];
    console.log("SERVER", `Presentation ${id} disconnected`);
  });

  const state = GameState.gameState;

  if (state >= 0) {
    const id = GameState.questionId;
    const totalQuestions = GameState.questions.length;
    const question = GameState.questions[id].question;
    res.write(
      `data: ${JSON.stringify({
        type: "showQuestion",
        question,
        id,
        totalQuestions,
      })}\n\n`
    );
  }

  if (state >= 1) {
    const id = GameState.questionId;
    const A = GameState.questions[id].A;
    const B = GameState.questions[id].B;
    const C = GameState.questions[id].C;
    const D = GameState.questions[id].D;
    res.write(
      `data: ${JSON.stringify({
        type: "showAnswers",
        A,
        B,
        C,
        D,
      })}\n\n`
    );
  }

  if (state >= 2) {
    const rightAnswer = GameState.questions[GameState.questionId].answer;
    const answers = GameState.answers;

    res.write(
      `data: ${JSON.stringify({
        type: "showVotes",
        answers,
        rightAnswer,
      })}\n\n`
    );
  }

  if (state >= 10) {
    res.write(
      `data: ${JSON.stringify({
        type: "gameEnded",
      })}\n\n`
    );
  }

  if (state === 20) {
    res.write(
      `data: ${JSON.stringify({
        type: "showResults",
        results: GameState.results,
      })}\n\n`
    );
  }
});

app.post("/admin/update", function (req, res) {
  if (!(req.body.ID in admins)) return res.json(false);

  switch (req.body.type) {
    case "gameStart":
      if (GameState.gameState !== -1) break;
      GameState.gameState = 0;
      broadcast_data(true, true, true, { type: "gameStart" });
      ShowQuestion();
      break;
    case "nextQuestion":
      if (GameState.gameState !== 2) break;
      GameState.gameState = 0;
      GameState.questionId++;
      if (GameState.questionId >= GameState.questions.length) {
        GameState.questionId = 0;
        GameState.gameState = 10;
        broadcast_data(true, true, true, { type: "gameEnded" });

        let results = [];

        for (const p of Object.values(players))
          if (!(p.name in GameState.points)) GameState.points[p.name] = 0;

        for (const name of Object.keys(GameState.points)) {
          results.push({ name, points: GameState.points[name] });
        }

        results.sort((a, b) => b.points - a.points);

        GameState.results = results;

        broadcast_data(false, false, true, { type: "results", results });
      } else ShowQuestion();
      break;
    case "showAnswers":
      if (GameState.gameState !== 0) break;
      GameState.gameState = 1;
      ShowAnswers();
      break;
    case "endAnswers":
      if (GameState.gameState !== 1) break;
      GameState.gameState = 2;
      ShowVotes();
      break;
    case "showResults":
      if (GameState.gameState !== 10) break;
      GameState.gameState = 20;

      broadcast_data(true, true, true, {
        type: "showResults",
        results: GameState.results,
      });
      break;
  }

  res.json(true);
});

app.post("/player/answer", function (req, res) {
  console.log(players[req.body.ID].name);
  if (GameState.gameState !== 1) return res.json(false);
  const ID = req.body.ID;
  if (!(ID in players) || ID in GameState.whoAnswered) return res.json(false);
  GameState.whoAnswered[ID] = true;
  const answer = req.body.answer;
  if (!"ABCD".includes(answer)) return res.json(false);
  GameState.answers[answer]++;
  if (
    GameState.questionId > 0 &&
    GameState.questions[GameState.questionId].answer === answer
  ) {
    GameState.scored[players[ID].name] = GameState.pointValue;
    GameState.pointValue = Math.ceil(GameState.pointValue * 0.95);
  }
  broadcast_data(false, false, true, {
    type: "answerSubmitted",
    total: GameState.answers,
  });
  res.json(true);
});

function ShowQuestion() {
  GameState.scored = {};
  GameState.whoAnswered = {};
  GameState.answers = { A: 0, B: 0, C: 0, D: 0 };
  GameState.pointValue = 100;
  const id = GameState.questionId;
  const totalQuestions = GameState.questions.length;
  const question = GameState.questions[id].question;
  broadcast_data(true, true, true, {
    type: "showQuestion",
    question,
    id,
    totalQuestions,
  });
}

function ShowAnswers() {
  const id = GameState.questionId;
  const A = GameState.questions[id].A;
  const B = GameState.questions[id].B;
  const C = GameState.questions[id].C;
  const D = GameState.questions[id].D;
  broadcast_data(true, true, true, { type: "showAnswers", A, B, C, D });
  broadcast_data(false, false, true, {
    type: "rightAnswer",
    answer: GameState.questions[GameState.questionId].answer,
  });
}

function ShowVotes() {
  const rightAnswer = GameState.questions[GameState.questionId].answer;
  const answers = GameState.answers;

  for (const p of Object.values(players)) {
    const name = p.name;
    const scored = name in GameState.scored ? GameState.scored[name] : 0;
    if (name in GameState.points) GameState.points[name] += scored;
    else GameState.points[name] = scored;
    p.res.write(
      `data: ${JSON.stringify({
        type: "showVotes",
        score: GameState.points[p.name],
        scored,
        answers,
        rightAnswer,
      })}\n\n`
    );
  }

  broadcast_data(false, true, true, {
    type: "showVotes",
    answers,
    rightAnswer,
  });
}

app.listen(8000, () => console.log("app listening on port 8000!"));
