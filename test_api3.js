const { Client } = require("pg");
const client = new Client({
  connectionString: process.env.DATABASE_URL
});
async function run() {
  await client.connect();
  const res = await client.query("SELECT * FROM \"Mess\" LIMIT 1");
  console.log("Mess:", res.rows[0]);
  const user = await client.query("SELECT * FROM \"User\" LIMIT 1");
  console.log("User:", user.rows[0].email);
  await client.end();
}
run();
