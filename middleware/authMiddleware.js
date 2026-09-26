const DEFAULT_KEYS = ["Abcd123456789@|", "marketease_live_ak_9f8e7d6c5b4a321"];

const apiKeyMiddleware = (req, res, next) => {
  const apiKey = req.header("x-api-key");

  const validKeys = new Set(
    [
      ...DEFAULT_KEYS,
      process.env.API_KEY,
      process.env.MARKETEASE_API_KEY,
    ].filter(Boolean)
  );

  if (!apiKey || !validKeys.has(apiKey)) {
    return res.status(403).json({
      success: false,
      message: "Forbidden: Invalid API Key. Provide a valid x-api-key header."
    });
  }
  next();
};

export default apiKeyMiddleware;