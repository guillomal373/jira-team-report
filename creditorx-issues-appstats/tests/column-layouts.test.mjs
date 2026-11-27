import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createDashboardLoader } from "../scripts/lib/dashboard-loader.mjs";

const OLD_HEADER =
  "Customer Name,Reported By,Date,Carrier/Provider,Customer ID,IOS or Android,CreditorX Device,Reported Issue,Module/Section,Status,Tier 2 State,Tier 2 Comments,Dev Team Comments,Jira Ticket,Priority";
const NEW_HEADER =
  "Customer Name,Reported By,Date,Carrier/Provider,Carrier/Provider2,Carrier/Provider/Otro,Customer ID,Operating system,Brand and Model,What was the customer trying to do?,Which part of the app has the issue?,Which other part of the app?,What Happened?,Time to Call,Module/Section,Status,Tier 2 State,Tier 2 Comments,Dev Team Comments,Jira Ticket,Priority";

async function loadFiles(files) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "layouts-"));
  const paths = [];
  for (const [name, content] of Object.entries(files)) {
    const file = path.join(dir, name);
    await fs.writeFile(file, content, "utf8");
    paths.push(file);
  }
  const loader = await createDashboardLoader();
  const { main } = await loader.merge(paths);
  const col = (name) => main.headers.indexOf(name);
  return { main, col };
}

test("old and new export layouts merge into the same columns", async () => {
  const oldRow = "Ann,a@x.com,2026-10-01,Verizon,111,Android,Pixel,voicemail broken,Blocked List,,Solved,,,,";
  // New layout: carrier in Carrier/Provider2, module in "Which part of the app has the issue?".
  const newRow = "Bob,b@x.com,2026-11-20,,T-mobile,,222,IOS,iPhone 15,cannot log in,Login,,button does nothing,anytime,,,New,,,,";
  const { main, col } = await loadFiles({
    "Issues-1-oct-2026.csv": `${OLD_HEADER}\n${oldRow}\n`,
    "Issues-20-nov-2026.csv": `${NEW_HEADER}\n${newRow}\n`,
  });

  ["IOS or Android", "CreditorX Device", "Reported Issue", "Carrier/Provider2"].forEach((name) =>
    assert.equal(main.headers.includes(name), false, `${name} should not survive`)
  );
  ["Operating system", "Brand and Model", "What was the customer trying to do?", "What Happened?", "Carrier/Provider", "Module/Section"].forEach(
    (name) => assert.ok(col(name) >= 0, `${name} should exist`)
  );

  const byCustomer = new Map(main.rows.map((row) => [row[col("Customer ID")], row]));
  const old = byCustomer.get("111");
  const fresh = byCustomer.get("222");

  assert.equal(old[col("Operating system")], "Android");
  assert.equal(old[col("What was the customer trying to do?")], "voicemail broken");
  assert.equal(old[col("Carrier/Provider")], "Verizon");
  assert.equal(old[col("Module/Section")], "Blocked List");

  assert.equal(fresh[col("Carrier/Provider")], "T-mobile");
  assert.equal(fresh[col("Module/Section")], "Auth/Login");
  assert.equal(fresh[col("Which part of the app has the issue?")], "Login");
  assert.equal(fresh[col("What Happened?")], "button does nothing");
});

test('carrier "Otro" uses the typed name; empty answers stay "Otro"; Module/Section is never overwritten', async () => {
  const rows = [
    "A,a@x.com,2026-11-20,,Otro,Cellcom,1,IOS,,text a,Login,,,,Setup,,New,,,,",
    "B,b@x.com,2026-11-20,,Otro,N/A,2,IOS,,text b,Blocked,,,,,,New,,,,",
    "C,c@x.com,2026-11-20,AT&T,Verizon,,3,IOS,,text c,Voicemail,,,,,,New,,,,",
  ];
  const { main, col } = await loadFiles({ "Issues-20-nov-2026.csv": `${NEW_HEADER}\n${rows.join("\n")}\n` });
  const byCustomer = new Map(main.rows.map((row) => [row[col("Customer ID")], row]));

  assert.equal(byCustomer.get("1")[col("Carrier/Provider")], "Cellcom");
  assert.equal(byCustomer.get("1")[col("Module/Section")], "Setup"); // already set, kept
  assert.equal(byCustomer.get("2")[col("Carrier/Provider")], "Otro");
  assert.equal(byCustomer.get("2")[col("Module/Section")], "Blocked List");
  assert.equal(byCustomer.get("3")[col("Carrier/Provider")], "AT&T"); // existing value wins
  assert.equal(byCustomer.get("3")[col("Module/Section")], "Voicemail"); // unmapped value passes through
});

test("one customer with two issues on one day stays two issues across old and new layouts", async () => {
  const oldRows = [
    "A,a@x.com,2026-11-10,Verizon,5,Android,P,first problem,,,,,,,",
    "A,a@x.com,2026-11-10,Verizon,5,IOS,P,second problem,,,,,,,",
  ];
  const newRows = [
    "A,a@x.com,2026-11-10,,Verizon,,5,Android,P,first problem,,,,,,,,Solved,,,,",
    "A,a@x.com,2026-11-10,,Verizon,,5,IOS,P,second problem,,,,,,,,Solved,,,,",
  ];
  const { main } = await loadFiles({
    "Issues-10-nov-2026.csv": `${OLD_HEADER}\n${oldRows.join("\n")}\n`,
    "Issues-12-nov-2026.csv": `${NEW_HEADER}\n${newRows.join("\n")}\n`,
  });

  assert.equal(main.rows.length, 2);
});
