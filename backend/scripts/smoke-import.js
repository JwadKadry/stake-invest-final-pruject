const RESOURCE_ID = process.env.RESOURCE_ID;
if (!RESOURCE_ID) throw new Error("Set RESOURCE_ID env var first");

(async () => {
  const url = `https://data.gov.il/api/3/action/datastore_search?resource_id=${RESOURCE_ID}&limit=5`;
  const res = await fetch(url);
  const json = await res.json();
  console.log("success:", json.success);
  console.log("records sample:", json.result.records[0]);
})();
