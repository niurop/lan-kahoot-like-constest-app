# lan-kahoot-like-constest-app

A simple app written for hosting kahoot like contests but geared towards LAN.

The code was written at the last second, so it is not clean, but it is usable (I still plan on rewriting it).

Game tested with 18 live participants, without any issues.

[contest-app-showcase.webm](https://user-images.githubusercontent.com/28646040/217373910-a7d5a67f-aa30-408e-9257-81fbad949ce8.webm)

## Requirements

### Host:

- LAN (wifi hotspot / local ethernet) - no need for internet
- ability to run `Nodejs` with `express` library over LAN

### Players / Presentations / Admins:

- ability to connect to LAN with the host - no need for internet
- modern web browser (needs EventSource)

## Usage

- Create LAN
- Find Your localhost IP address for the host
- Write instructions on how to connect and how to open a page (usually: `HTTP://<HOST-IP>:8000`) into `server/gameConfig.json`
- Write Questions to `server/gameConfig.json` (the first question is a test question and the points don't count)
- Check admin password in `server/gameConfig.json`
- Go to folder `server` (`$cd server`)
- [if needed] Install `express` library (`$npm install express --save`)
- Run the server (`$node server.js`)
- Open URL: `HTTP://<HOST-IP>:8000/admin` in Your browser and enter admin password
- [if needed] Connect to LAN on device meant for presentation and open URL: `HTTP://<HOST-IP>:8000/presentation` in Your browser
- Ask players to connect to LAN and open URL: `HTTP://<HOST-IP>:8000` in their browsers
- Play
