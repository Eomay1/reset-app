const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: JSON_HEADERS,
    body: JSON.stringify(body)
  };
}

function methodNotAllowed(allowedMethods) {
  return {
    ...json(405, { error: "Method not allowed." }),
    headers: {
      ...JSON_HEADERS,
      allow: allowedMethods.join(", ")
    }
  };
}

module.exports = { json, methodNotAllowed };
