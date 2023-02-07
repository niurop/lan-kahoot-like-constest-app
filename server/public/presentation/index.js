(async () => {
  const GET = (url) => fetch(url).then((e) => e.json());

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

  const gameConfig = await GET("/game-config");

  {
    lobbyScr.elements.instructions.innerHTML = gameConfig.instructions;

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
  }

  if (!!window.EventSource) {
    {
      const source = new EventSource(`/presentation/subscribe`);

      source.onmessage = (e) => {
        const data = JSON.parse(e.data);
        console.log(data);
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

            questionScr.classList.remove("show-answers");

            questionScr.elements.question.innerText = data.question;
            questionScr.elements.question_id.innerText = data.id + 1;
            questionScr.elements.totalQuestions.innerText = data.totalQuestions;

            questionScr.elements.A.innerText = "";
            questionScr.elements.B.innerText = "";
            questionScr.elements.C.innerText = "";
            questionScr.elements.D.innerText = "";

            questionScr.elements.Apre.innerText = "";
            questionScr.elements.Bpre.innerText = "";
            questionScr.elements.Cpre.innerText = "";
            questionScr.elements.Dpre.innerText = "";

            questionScr.elements.Adiv.classList.remove("right-answer");
            questionScr.elements.Bdiv.classList.remove("right-answer");
            questionScr.elements.Cdiv.classList.remove("right-answer");
            questionScr.elements.Ddiv.classList.remove("right-answer");
            break;
          case "showAnswers":
            questionScr.goto();

            questionScr.classList.add("show-answers");

            questionScr.elements.A.innerText = data.A;
            questionScr.elements.B.innerText = data.B;
            questionScr.elements.C.innerText = data.C;
            questionScr.elements.D.innerText = data.D;
            break;
          case "showVotes":
            questionScr.goto();
            questionScr.elements[data.rightAnswer + "div"].classList.add(
              "right-answer"
            );
            questionScr.elements.Apre.innerText = data.answers.A;
            questionScr.elements.Bpre.innerText = data.answers.B;
            questionScr.elements.Cpre.innerText = data.answers.C;
            questionScr.elements.Dpre.innerText = data.answers.D;
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
    }
  } else {
    loadingScr.children[0].innerText = "Your browser doesn't support SSE";
  }

  lobbyScr.goto();
})();
