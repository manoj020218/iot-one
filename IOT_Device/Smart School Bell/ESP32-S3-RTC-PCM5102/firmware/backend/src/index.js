import { createSchoolBellMediaServer } from "./server.js";

const port = Number.parseInt(process.env.PORT ?? "4180", 10);
const server = createSchoolBellMediaServer({ port });

server.listen(port, () => {
  console.log(`school-bell-media-backend listening on http://127.0.0.1:${port}`);
});
