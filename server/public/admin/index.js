(async () => {
  const POST = (url, data) =>
    fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }).then((e) => e.json());

  const GET = (url) => fetch(url).then((e) => e.json());

  window.ID = null;
  const screens = {};
  window.activeScreen = null;
  document.querySelectorAll("app-screen").forEach((s) => {
    if (activeScreen === null) activeScreen = s;
    screens[s.id] = s;
    window[s.id + "Scr"] = s;
    s.elements = {};
    s.querySelectorAll("[id]").forEach((e) => (s.elements[e.id] = e));

    s.hide = (self) => {
      self.classList.add("app-screen-hidden", "app-screen-hidden-animation");
    };

    s.show = (self) => {
      self.classList.remove("app-screen-hidden", "app-screen-hidden-animation");
    };

    s.goto = async () => {
      if (s !== activeScreen) {
        activeScreen.hide(activeScreen);
        if (!!s.screenChange) await s.screenChange(s);
        s.show(s);
        activeScreen = s;
      }
    };
  });

  let gameConfig = await GET("/game-config");
  console.log(gameConfig);

  if (!!window.EventSource) {
    window.subscribeWithId = (id) => {
      var source = new EventSource(`/admin/subscribe?id=${id}`);

      source.onmessage = (e) => {
        const data = JSON.parse(e.data);
        console.log(data);
        switch (data.type) {
          case "initialStateUpdate":
            gameConfig = data.GameState;
            break;
          case "newPlayers":
            data.players.forEach((p) => lobbyScr.newPlayer(p.name));
            questionScr.elements.total.innerText =
              lobbyScr.elements.nOfPlayers.innerText =
                lobbyScr.elements.userList.childElementCount;
            break;
          case "removePlayers":
            data.players.forEach((p) => lobbyScr.removePlayer(p.name));
            questionScr.elements.total.innerText =
              lobbyScr.elements.nOfPlayers.innerText =
                lobbyScr.elements.userList.childElementCount;
            break;
          case "gameStart":
            questionScr.goto();
            break;
          case "showQuestion":
            questionScr.goto();
            questionScr.elements.answers.innerText = 0;
            questionScr.elements.question.innerText = data.question;
            questionScr.elements.question_id.innerText = data.id + 1;
            questionScr.elements.totalQuestions.innerText = data.totalQuestions;
            questionScr.elements.next.innerText = "showAnswers";

            questionScr.elements.A.innerText = " ";
            questionScr.elements.B.innerText = " ";
            questionScr.elements.C.innerText = " ";
            questionScr.elements.D.innerText = " ";

            questionScr.elements.Apre.innerText = "0";
            questionScr.elements.Bpre.innerText = "0";
            questionScr.elements.Cpre.innerText = "0";
            questionScr.elements.Dpre.innerText = "0";

            questionScr.elements.Adiv.classList.remove("right-answer");
            questionScr.elements.Bdiv.classList.remove("right-answer");
            questionScr.elements.Cdiv.classList.remove("right-answer");
            questionScr.elements.Ddiv.classList.remove("right-answer");
            break;
          case "showAnswers":
            questionScr.goto();
            questionScr.elements.A.innerText = data.A;
            questionScr.elements.B.innerText = data.B;
            questionScr.elements.C.innerText = data.C;
            questionScr.elements.D.innerText = data.D;

            questionScr.elements.next.innerText = "endAnswers";
            break;
          case "rightAnswer":
            questionScr.goto();
            questionScr.elements[data.answer + "div"].classList.add(
              "right-answer"
            );
            break;
          case "answerSubmitted":
            questionScr.goto();
            questionScr.elements.answers.innerText =
              +data.total.A + data.total.B + data.total.C + data.total.D;
            questionScr.elements.Apre.innerText = data.total.A;
            questionScr.elements.Bpre.innerText = data.total.B;
            questionScr.elements.Cpre.innerText = data.total.C;
            questionScr.elements.Dpre.innerText = data.total.D;
            console.log(data);
            break;
          case "showVotes":
            questionScr.goto();
            questionScr.elements.next.innerText = "nextQuestion";
            break;
          case "gameEnded":
            awardsScr.goto();
            break;
          case "results":
            if (data.results.length > 0) {
              const res = data.results;
              let max = res[0].points;
              let place = 1;
              console.log(res);
              for (const { name, points } of res) {
                if (max > points) {
                  max = points;
                  place++;
                }
                const div = document.createElement("div");
                const placeDiv = document.createElement("div");
                const nameDiv = document.createElement("div");
                const pointsDiv = document.createElement("div");
                div.append(placeDiv);
                div.append(nameDiv);
                div.append(pointsDiv);
                placeDiv.innerText = place;
                nameDiv.innerText = name;
                pointsDiv.innerText = points + "p";
                div.classList.add("winner-" + place);
                awardsScr.elements.winners.append(div);
              }
            }
            break;
          case "showResults":
            awardsScr.elements.showResults.remove();
            break;
          default:
            console.log(data);
        }
      };

      source.onopen = (e) => {
        console.log("CONNECTED");
      };

      source.onerror = (e) => {
        if (e.eventPhase == EventSource.CLOSED) source.close();
        if (e.target.readyState == EventSource.CLOSED) {
          console.log("Disconnected");
          window.location.reload();
        } else if (e.target.readyState == EventSource.CONNECTING) {
          console.log("Connecting...");
        }
      };
    };
  } else {
    loadingScr.children[0].innerText = "Your browser doesn't support SSE";
  }

  {
    // loginScr
    const cfg = gameConfig.login;

    loginScr.elements.title.innerText = gameConfig.title;

    loginScr.elements.password.focus();

    loginScr.elements.continueBtn.onclick = () => {
      loginScr.elements.password.blur();
      const password = loginScr.elements.password.innerText
        .trim()
        .replace("\n", "");
      loginScr.elements.password.innerText = password;

      let valid = true;
      loginScr.elements.password.classList.remove("invalid");
      loginScr.elements.password.offsetWidth;
      loginScr.elements.password_error.innerText = "";

      POST("/admin/register", { password }).then((res) => {
        if (res === false) {
          loginScr.elements.password.classList.add("invalid");
          loginScr.elements.password_error.innerText = "Bad password!";
          loginScr.elements.password.focus();
        } else {
          ID = res;
          subscribeWithId(res);
          lobbyScr.goto();
        }
      });
    };

    loginScr.elements.password.oninput = (e) => {
      if (loginScr.elements.password.innerText.includes("\n"))
        loginScr.elements.continueBtn.click();
    };
  }

  {
    lobbyScr.newPlayer = (name) => {
      const playerElem = document.createElement("div");
      playerElem.innerText = name;
      lobbyScr.elements.userList.append(playerElem);
    };

    lobbyScr.removePlayer = (name) => {
      Array.from(lobbyScr.elements.userList.childNodes)
        .filter((c) => c.innerText == name)
        .forEach((e) => e.remove());
    };

    lobbyScr.elements.startgameBtn.onclick = () => {
      POST("/admin/update", { ID, type: "gameStart" });
    };
  }

  {
    questionScr.elements.next.onclick = () => {
      POST("/admin/update", { ID, type: questionScr.elements.next.innerText });
    };
  }

  {
    awardsScr.elements.showResults.onclick = () => {
      POST("/admin/update", { ID, type: "showResults" });
    };
  }

  loginScr.goto();
})();
