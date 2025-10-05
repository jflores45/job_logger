// server/index.js
const express = require("express");
const puppeteer = require("puppeteer");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const app = express();
app.use(cors());
app.use(express.json());

// Simple rate limit: allow 1 request every 5 seconds per IP
const limiter = rateLimit({
  windowMs: 5 * 1000,
  max: 1,
  message: "Too many requests, please wait a few seconds before trying again.",
});
app.use("/api/scrape", limiter);

// Basic route
app.get("/api/message", (req, res) => {
  res.json({ message: "Hello from the server!" });
});

// Scrape route using Puppeteer
app.post("/api/scrape", async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: "Missing URL" });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle2" });

    // Extract visible content from page
    let role = "";
    let company = "";
    let location = "";
    let description = "";

    if (url.includes("linkedin.com")) {
      role = await page.$eval("h1", el => el.innerText).catch(() => "");
      company = await page.$eval(".topcard__flavor", el => el.innerText).catch(() => "");
      location = await page.$eval(".topcard__flavor--bullet", el => el.innerText).catch(() => "");
      description = await page.$eval(".description__text", el => el.innerText).catch(() => "");
    } else if (url.includes("indeed.com")) {
      role = await page.$eval("h1.jobsearch-JobInfoHeader-title", el => el.innerText).catch(() => "");
      company = await page.$eval(".jobsearch-CompanyInfoWithoutHeaderImage div:first-child", el => el.innerText).catch(() => "");
      location = await page.$eval(".jobsearch-CompanyInfoWithoutHeaderImage div:nth-child(2)", el => el.innerText).catch(() => "");
      description = await page.$eval("#jobDescriptionText", el => el.innerText).catch(() => "");
    } else if (url.includes("glassdoor.com")) {
      role = await page.$eval("h1", el => el.innerText).catch(() => "");
      company = await page.$eval(".employerName", el => el.innerText).catch(() => "");
      location = await page.$eval(".location", el => el.innerText).catch(() => "");
      description = await page.$eval(".jobDescriptionContent", el => el.innerText).catch(() => "");
    } else {
      // Fallback: just grab some text
      role = await page.$eval("h1, h2", el => el.innerText).catch(() => "");
      description = await page.$eval("body", el => el.innerText.slice(0, 500)).catch(() => "");
    }

    res.json({ role, company, location, description });
  } catch (err) {
    console.error("Scrape failed:", err);
    res.status(500).json({ error: "Failed to scrape" });
  } finally {
    if (browser) await browser.close();
  }
});

app.listen(5000, () => console.log("✅ Server running on http://localhost:5000"));
