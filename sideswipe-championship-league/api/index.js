import { config } from "dotenv";
config();

import { app } from "./server.js";

const PORT = process.env.API_PORT || 4000;

app.listen(PORT, () => {
  console.log(`SCL Tournament API running on http://localhost:${PORT}`);
});
