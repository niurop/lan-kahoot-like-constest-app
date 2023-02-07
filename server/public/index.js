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

(async () => {
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
      activeScreen.hide(activeScreen);
      if (!!s.screenChange) await s.screenChange(s);
      s.show(s);
      activeScreen = s;
    };
  });

  if (!!window.EventSource) {
    window.subscribeWithId = (id) => {
      var source = new EventSource(`/player/subscribe?id=${id}`);

      source.onmessage = (e) => {
        const data = JSON.parse(e.data);
        //console.log(data);
        switch (data.type) {
          case "newPlayers":
            data.players.forEach((p) => lobbyScr.newPlayer(p.name));
            break;
          case "removePlayers":
            data.players.forEach((p) => lobbyScr.removePlayer(p.name));
            break;
          case "gameStart":
            questionScr.goto();
            break;
          case "showQuestion":
            questionScr.goto();

            questionScr.elements.buttons.classList.add("disabled");

            questionScr.classList.remove("show-answers");

            questionScr.elements.question.innerText = data.question;
            questionScr.elements.question_id.innerText = data.id + 1;
            questionScr.elements.totalQuestions.innerText = data.totalQuestions;

            questionScr.elements.A.innerText = "";
            questionScr.elements.B.innerText = "";
            questionScr.elements.C.innerText = "";
            questionScr.elements.D.innerText = "";

            questionScr.elements.Adiv.classList.remove("chosen-answer");
            questionScr.elements.Bdiv.classList.remove("chosen-answer");
            questionScr.elements.Cdiv.classList.remove("chosen-answer");
            questionScr.elements.Ddiv.classList.remove("chosen-answer");

            questionScr.elements.question_id.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
            break;
          case "showAnswers":
            questionScr.goto();

            questionScr.classList.add("show-answers");

            questionScr.elements.D.parentNode.scrollIntoView({
              behavior: "smooth",
              block: "end",
            });

            questionScr.elements.buttons.classList.remove("disabled");

            questionScr.elements.A.innerText = data.A;
            questionScr.elements.B.innerText = data.B;
            questionScr.elements.C.innerText = data.C;
            questionScr.elements.D.innerText = data.D;
            break;
          case "showVotes":
            questionScr.goto();

            questionScr.elements.question_id.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
            questionScr.elements.buttons.classList.add("disabled");
            questionScr.elements.question.innerHTML = `Your points:<br/>${
              data.score
            } = ${data.score - data.scored}+${data.scored}!`;

            waitingScr.elements.score.innerText = `Your points: ${data.score}`;
            break;
          case "gameEnded":
            waitingScr.goto();
            break;
          case "showResults":
            awardsScr.goto();
            if (data.results.length > 0) {
              const res = data.results;
              let max = res[0].points;
              let place = 1;
              //console.log(res);
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
                if (name === lobbyScr.elements.player.innerText)
                  div.classList.add("player");
                awardsScr.elements.winners.append(div);
              }
            }
            break;
          default:
            //console.log(data);
            break;
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

  const gameConfig = await GET("/game-config");

  {
    // loginScr
    const cfg = gameConfig.login;
    cfg.allowedSymbols = new RegExp(cfg.allowedSymbols);

    loginScr.elements.title.innerText = gameConfig.title;

    loginScr.elements.name.focus();

    loginScr.elements.continueBtn.onclick = () => {
      loginScr.elements.name.blur();
      const name = loginScr.elements.name.innerText.trim().replace("\n", "");
      loginScr.elements.name.innerText = name;

      let valid = true;
      loginScr.elements.name.classList.remove("invalid");
      loginScr.elements.name.offsetWidth;
      loginScr.elements.login_error.innerText = "";

      const check_for_invalid_name = (msg) => {
        if (msg === true || !valid) return;
        valid = false;
        loginScr.elements.name.classList.add("invalid");
        loginScr.elements.login_error.innerText = msg;
        loginScr.elements.name.focus();
      };

      check_for_invalid_name(
        name.length >= cfg.minLength || cfg.minLengthError
      );
      check_for_invalid_name(
        name.length <= cfg.maxLength || cfg.maxLengthError
      );

      if (!valid) return;

      check_for_invalid_name(
        cfg.allowedSymbols.test(name) || cfg.allowedSymbolsError
      );

      if (!valid) return;

      fetch("/player/register-name", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      })
        .then((e) => e.json())
        .then((res) => {
          if (res === false) {
            //console.log("gameConfig.gameState:", gameConfig.gameState);
            if (gameConfig.gameState === -1)
              check_for_invalid_name(false || cfg.loginTakenError);
            else check_for_invalid_name(false || cfg.loginUnknownError);
          } else {
            ID = res;
            subscribeWithId(res);
            lobbyScr.elements.player.innerText = name;
            waitingScr.elements.name.innerText = name;
            lobbyScr.goto();
          }
        });
    };

    loginScr.elements.name.oninput = (e) => {
      if (loginScr.elements.name.innerText.includes("\n"))
        loginScr.elements.continueBtn.click();
    };
  }

  {
    lobbyScr.newPlayer = (name) => {
      if (name === lobbyScr.elements.player.innerText) return;
      const playerElem = document.createElement("div");
      playerElem.innerText = name;
      lobbyScr.elements.userList.append(playerElem);
    };

    lobbyScr.removePlayer = (name) => {
      Array.from(lobbyScr.elements.userList.childNodes)
        .filter((c) => c.innerText == name)
        .forEach((e) => e.remove());
    };
  }

  {
    questionScr.elements.buttons.onclick = function (e) {
      if (questionScr.elements.buttons.classList.contains("disabled"))
        return false;
      if (
        e.target.tagName === "BUTTON" ||
        e.target.parentNode.tagName === "BUTTON"
      ) {
        const id = e.target.id[0];
        questionScr.elements.buttons.classList.add("disabled");
        POST("/player/answer", { ID, answer: id });
        questionScr.elements[id + "div"].classList.add("chosen-answer");
      }
    };
  }

  loginScr.goto();
})();
