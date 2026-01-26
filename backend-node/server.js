const express = require("express");
const dotenv = require("dotenv");
const {
  S3Client,
  ListBucketsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const { createClient } = require("@supabase/supabase-js");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const multer = require("multer");
const path = require("path");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const s3Endpoint = process.env.S3_ENDPOINT;
const s3Region = process.env.S3_REGION;
const s3AccessKeyId = process.env.S3_ACCESS_KEY_ID;
const s3SecretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
const s3Bucket = process.env.S3_BUCKET;
const s3 =
  s3Endpoint && s3Region && s3AccessKeyId && s3SecretAccessKey
    ? new S3Client({
        region: s3Region,
        endpoint: s3Endpoint,
        credentials: {
          accessKeyId: s3AccessKeyId,
          secretAccessKey: s3SecretAccessKey,
        },
        forcePathStyle: true,
      })
    : null;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

app.use(cors({ origin: true, credentials: true }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/health", (req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

app.get("/me", async (req, res) => {
  if (!supabase) {
    return res.status(500).json({
      ok: false,
      error: "Missing SUPABASE_URL or SUPABASE_KEY",
    });
  }

  const accessToken = req.cookies["sb-access-token"];
  if (!accessToken) {
    return res.status(401).json({ ok: false, error: "Not authenticated" });
  }

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error) {
    return res.status(401).json({ ok: false, error: error.message });
  }

  return res.json({ ok: true, user: data.user });
});

app.get("/api/supabase-status", async (req, res) => {
  if (!supabase) {
    return res.status(500).json({
      ok: false,
      error: "Missing SUPABASE_URL or SUPABASE_KEY",
    });
  }

  return res.json({ ok: true });
});

app.get("/s3/buckets", async (req, res) => {
  if (!s3) {
    return res.status(500).json({
      ok: false,
      error: "Missing S3 configuration",
    });
  }

  try {
    const data = await s3.send(new ListBucketsCommand({}));
    return res.json({ ok: true, buckets: data.Buckets || [] });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/s3/objects", async (req, res) => {
  if (!s3) {
    return res.status(500).json({
      ok: false,
      error: "Missing S3 configuration",
    });
  }

  const bucket = s3Bucket;
  if (!bucket) {
    return res.status(400).json({ ok: false, error: "Missing bucket name" });
  }

  const maxKeysRaw = Number(req.query.maxKeys);
  const maxKeys = Number.isFinite(maxKeysRaw) ? Math.min(Math.max(maxKeysRaw, 1), 1000) : 50;

  try {
    const data = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: req.query.prefix || undefined,
        ContinuationToken: req.query.continuationToken || undefined,
        MaxKeys: maxKeys,
      })
    );
    return res.json({
      ok: true,
      bucket,
      objects: data.Contents || [],
      isTruncated: Boolean(data.IsTruncated),
      nextToken: data.NextContinuationToken || null,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/s3/upload", upload.single("file"), async (req, res) => {
  if (!s3) {
    return res.status(500).json({ ok: false, error: "Missing S3 configuration" });
  }

  if (!s3Bucket) {
    return res.status(400).json({ ok: false, error: "Missing bucket name" });
  }

  if (!req.file) {
    return res.status(400).json({ ok: false, error: "Missing file" });
  }

  const key = req.body.key || req.file.originalname;
  if (!key) {
    return res.status(400).json({ ok: false, error: "Missing object key" });
  }

  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: s3Bucket,
        Key: key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      })
    );
    return res.json({ ok: true, bucket: s3Bucket, key });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/s3/download/*", async (req, res) => {
  if (!s3) {
    return res.status(500).json({ ok: false, error: "Missing S3 configuration" });
  }

  if (!s3Bucket) {
    return res.status(400).json({ ok: false, error: "Missing bucket name" });
  }

  const key = req.params[0] || req.query.key;
  if (!key) {
    return res.status(400).json({ ok: false, error: "Missing object key" });
  }

  try {
    const data = await s3.send(
      new GetObjectCommand({
        Bucket: s3Bucket,
        Key: key,
      })
    );

    if (data.ContentType) {
      res.setHeader("Content-Type", data.ContentType);
    }

    if (data.ContentLength) {
      res.setHeader("Content-Length", data.ContentLength.toString());
    }

    if (req.query.download === "1") {
      res.setHeader("Content-Disposition", `attachment; filename=\"${path.basename(key)}\"`);
    }

    if (data.Body && typeof data.Body.pipe === "function") {
      data.Body.pipe(res);
      return;
    }

    return res.status(500).json({ ok: false, error: "Invalid S3 response body" });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.delete("/s3/object", async (req, res) => {
  if (!s3) {
    return res.status(500).json({ ok: false, error: "Missing S3 configuration" });
  }

  if (!s3Bucket) {
    return res.status(400).json({ ok: false, error: "Missing bucket name" });
  }

  const key = req.query.key;
  if (!key) {
    return res.status(400).json({ ok: false, error: "Missing object key" });
  }

  try {
    await s3.send(
      new DeleteObjectCommand({
        Bucket: s3Bucket,
        Key: key,
      })
    );
    return res.json({ ok: true, bucket: s3Bucket, key });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/signup", async (req, res) => {
  if (!supabase) {
    return res.redirect("/error.html?msg=Missing%20SUPABASE_URL%20or%20SUPABASE_KEY");
  }

  const { email, password } = req.body;
  if (!email || !password) {
    return res.redirect("/error.html?msg=Missing%20email%20or%20password");
  }

  const { error } = await supabase.auth.signUp({ email, password });
  if (error) {
    return res.redirect(`/error.html?msg=${encodeURIComponent(error.message)}`);
  }

  return res.redirect("/signup_success.html");
});

app.post("/login", async (req, res) => {
  if (!supabase) {
    return res.redirect("/error.html?msg=Missing%20SUPABASE_URL%20or%20SUPABASE_KEY");
  }

  const { email, password } = req.body;
  if (!email || !password) {
    return res.redirect("/error.html?msg=Missing%20email%20or%20password");
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data?.session?.access_token) {
    return res.redirect(`/error.html?msg=${encodeURIComponent(error?.message || "Login failed")}`);
  }

  res.cookie("sb-access-token", data.session.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return res.redirect("/private.html");
});

app.post("/logout", (req, res) => {
  res.clearCookie("sb-access-token");
  return res.redirect("/");
});

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
