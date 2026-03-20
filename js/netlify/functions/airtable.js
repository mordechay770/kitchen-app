exports.handler = async (event) => {
  const TOKEN = process.env.AIRTABLE_TOKEN;
  const BASE  = process.env.AIRTABLE_BASE;

  if (!TOKEN || !BASE) {
    return { statusCode: 500, body: "Missing environment variables" };
  }

  const table  = event.queryStringParameters?.table || "";
  const filter = event.queryStringParameters?.filterByFormula || "";
  const sort   = event.queryStringParameters?.sort || "";
  const fields = event.queryStringParameters?.fields || "";
  const offset = event.queryStringParameters?.offset || "";
  const method = event.httpMethod;
  const recordId = event.queryStringParameters?.recordId || "";

  // Build Airtable URL
  let url = `https://api.airtable.com/v0/${BASE}/${encodeURIComponent(table)}`;
  if (recordId) url += `/${recordId}`;

  const params = new URLSearchParams();
  if (filter) params.set("filterByFormula", filter);
  if (sort)   params.set("sort[0][field]", sort);
  if (fields) params.set("fields[]", fields);
  if (offset) params.set("offset", offset);
  const qs = params.toString();
  if (qs && method === "GET") url += "?" + qs;

  const headers = {
    "Authorization": `Bearer ${TOKEN}`,
    "Content-Type": "application/json",
  };

  const fetchOptions = { method, headers };
  if (method !== "GET" && event.body) {
    fetchOptions.body = event.body;
  }

  try {
    const res  = await fetch(url, fetchOptions);
    const data = await res.json();
    return {
      statusCode: res.status,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
