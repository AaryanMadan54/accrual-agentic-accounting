declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    OPENAI_API_KEY?: string;
    OPENAI_MODEL?: string;
    AI_ENABLED?: string;
    AI_PROVIDER?: string;
    AI_MODEL?: string;
    GROQ_API_KEY?: string;
    AI_USAGE_APPROVED?: string;
    AI_DAILY_LIMIT?: string;
  }
}
