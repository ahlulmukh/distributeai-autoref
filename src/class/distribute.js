const axios = require("axios");
const { logMessage } = require("../utils/logger");
const { getProxyAgent } = require("./proxy");
const generator = new (require("../utils/generator"))();
const { faker } = require("@faker-js/faker");
const UserAgent = require("user-agents");
const cheerio = require("cheerio");

module.exports = class distributeAI {
  constructor(refCode, provider, proxy = null, currentNum, total) {
    this.refCode = refCode;
    this.provider = provider;
    this.proxy = proxy;
    this.currentNum = currentNum;
    this.total = total;
    this.axiosConfig = {
      ...(this.proxy && { httpsAgent: getProxyAgent(this.proxy) }),
      timeout: 60000,
    };
  }

  async makeRequest(method, url, config = {}, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const userAgent = new UserAgent().toString();
        const headers = {
          "User-Agent": userAgent,
          ...config.headers,
        };
        const response = await axios({
          method,
          url,
          ...this.axiosConfig,
          ...config,
          headers,
        });
        return response;
      } catch (error) {
        logMessage(
          this.currentNum,
          this.total,
          `Request failed: ${error.message}`,
          "error"
        );
        logMessage(
          this.currentNum,
          this.total,
          `Retrying... (${i + 1}/${retries})`,
          "process"
        );
        await new Promise((resolve) => setTimeout(resolve, 12000));
      }
    }
    return null;
  }

  async getRandomDomain() {
    logMessage(
      this.currentNum,
      this.total,
      "Trying to get a random domain...",
      "process"
    );

    const vowels = "aeiou";
    const consonants = "bcdfghjklmnpqrstvwxyz";
    const keyword =
      consonants[Math.floor(Math.random() * consonants.length)] +
      vowels[Math.floor(Math.random() * vowels.length)];
    try {
      const response = await this.makeRequest(
        "GET",
        `https://generator.email/search.php?key=${keyword}`
      );

      if (!response) {
        logMessage(
          this.currentNum,
          this.total,
          "No response from API",
          "error"
        );
        return null;
      }

      const domains = response.data.filter((d) => /^[\x00-\x7F]*$/.test(d));

      if (domains.length) {
        const selectedDomain =
          domains[Math.floor(Math.random() * domains.length)];
        logMessage(
          this.currentNum,
          this.total,
          `Selected domain: ${selectedDomain}`,
          "success"
        );
        return selectedDomain;
      }

      logMessage(
        this.currentNum,
        this.total,
        "Could not find valid domain",
        "error"
      );
      return null;
    } catch (error) {
      logMessage(
        this.currentNum,
        this.total,
        `Error getting random domain: ${error.message}`,
        "error"
      );
      return null;
    }
  }

  async generateEmail(domain) {
    logMessage(
      this.currentNum,
      this.total,
      "Trying to generate email...",
      "process"
    );

    const firstname = faker.person.firstName().toLowerCase();
    const lastname = faker.person.lastName().toLowerCase();
    const randomNums = Math.floor(Math.random() * 900 + 100).toString();

    const separator = Math.random() > 0.5 ? "" : ".";
    const email = `${firstname}${separator}${lastname}${randomNums}@${domain}`;

    logMessage(
      this.currentNum,
      this.total,
      `Generated email: ${email}`,
      "success"
    );
    return email;
  }

  async getCodeVerification(email, domain) {
    logMessage(
      this.currentNum,
      this.total,
      "Trying to get verification code...",
      "process"
    );

    const cookies = {
      embx: `%22${email}%22`,
      surl: `${domain}/${email.split("@")[0]}`,
    };

    const headers = {
      Cookie: Object.entries(cookies)
        .map(([key, value]) => `${key}=${value}`)
        .join("; "),
    };

    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      logMessage(
        this.currentNum,
        this.total,
        `Attempt ${attempt} Checking for verification code...`,
        "process"
      );

      try {
        const response = await this.makeRequest(
          "GET",
          "https://generator.email/inbox1/",
          { headers: headers }
        );

        if (!response || !response.data) {
          logMessage(
            this.currentNum,
            this.total,
            "No response from email server",
            "warning"
          );
          continue;
        }

        const $ = cheerio.load(response.data);
        let verificationCode = null;

        $("p").each((i, el) => {
          const text = $(el).text().trim();
          if (text.includes("verify?code=")) {
            const match = text.match(/verify\?code=([\w\d]+)/);
            if (match) {
              verificationCode = match[1];
              return false;
            }
          }
        });

        if (verificationCode) {
          logMessage(
            this.currentNum,
            this.total,
            `Verification Code Found: ${verificationCode}`,
            "success"
          );
          return verificationCode;
        }

        logMessage(
          this.currentNum,
          this.total,
          "Verification code not found, retrying...",
          "error"
        );
      } catch (error) {
        logMessage(
          this.currentNum,
          this.total,
          `Error getting verification code: ${error.message}`,
          "error"
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 10000));
    }

    logMessage(
      this.currentNum,
      this.total,
      "Failed to retrieve verification code after multiple attempts!",
      "error"
    );
    return null;
  }

  async registerAccount(email, password) {
    logMessage(
      this.currentNum,
      this.total,
      "Trying to register account...",
      "process"
    );

    const payload = {
      email: email,
      password: password,
      referralCode: this.refCode,
    };

    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
      Referer: "https://dashboard.distribute.ai",
      Origin: "https://dashboard.distribute.ai",
    };

    try {
      const response = await this.makeRequest(
        "POST",
        "https://api.distribute.ai/internal/auth/signup",
        {
          data: payload,
          headers: headers,
        }
      );

      if (response.status === 200) {
        logMessage(
          this.currentNum,
          this.total,
          "Account registered",
          "success"
        );
        return true;
      } else {
        logMessage(
          this.currentNum,
          this.total,
          "Account not registered",
          "error"
        );
      }
      return false;
    } catch (error) {
      logMessage(
        this.currentNum,
        this.total,
        `Error register account, message: ${error.message}`,
        "error"
      );
      return false;
    }
  }

  async verifyAccount(code) {
    logMessage(
      this.currentNum,
      this.total,
      "Trying to verify account...",
      "process"
    );

    const payload = {
      token: code,
    };

    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
      Referer: "https://dashboard.distribute.ai",
      Origin: "https://dashboard.distribute.ai",
    };

    try {
      const response = await this.makeRequest(
        "POST",
        "https://api.distribute.ai/internal/auth/verify-email",
        { headers: headers, data: payload }
      );
      if (response && response.data.message === "Your email was verified.") {
        logMessage(
          this.currentNum,
          this.total,
          "Verification successful!",
          "success"
        );
        return response.data;
      } else {
        logMessage(
          this.currentNum,
          this.total,
          "Verification failed!",
          "error"
        );
        return null;
      }
    } catch (error) {
      logMessage(
        this.currentNum,
        this.total,
        `Error verify account, message : ${error.message}`,
        "error"
      );
      return null;
    }
  }

  async loginUser(email, password) {
    logMessage(
      this.currentNum,
      this.total,
      "Trying to login account...",
      "process"
    );
    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
      Referer: "https://dashboard.distribute.ai",
      Origin: "https://dashboard.distribute.ai",
    };

    const payload = {
      email: email,
      password: password,
      rememberSession: false,
    };

    try {
      const response = await this.makeRequest(
        "POST",
        "https://api.distribute.ai/internal/auth/login",
        { headers: headers, data: payload }
      );

      if (response && response.data.token) {
        logMessage(this.currentNum, this.total, "Login successful!", "success");
        return response.data.token;
      }
      return null;
    } catch (error) {
      logMessage(
        this.currentNum,
        this.total,
        `Error login account, message : ${error.message}`,
        "error"
      );
      return null;
    }
  }

  async generateProvider(token) {
    logMessage(
      this.currentNum,
      this.total,
      "Trying to generate provider...",
      "process"
    );

    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `${token}`,
    };

    const providers = [];
    for (let i = 0; i < this.provider; i++) {
      const payload = {
        name: faker.person.firstName(),
        platform: "browser",
      };

      try {
        const response = await this.makeRequest(
          "POST",
          "https://api.distribute.ai/internal/auth/connect",
          { headers: headers, data: payload }
        );

        if (response.data) {
          logMessage(
            this.currentNum,
            this.total,
            `Provider ${i + 1} generated!`,
            "success"
          );
          providers.push(response.data);
        }
      } catch (error) {
        logMessage(
          this.currentNum,
          this.total,
          `Error generate provider ${i + 1}, message : ${error.message}`,
          "error"
        );
      }
    }

    return providers;
  }

  async singleProses() {
    logMessage(
      this.currentNum,
      this.total,
      "Proccesing register account",
      "debug"
    );
    try {
      const domain = await this.getRandomDomain();
      const email = await this.generateEmail(domain);
      const password = await generator.Password();
      const registerResponse = await this.registerAccount(email, password);
      if (registerResponse) {
        const verifyCode = await this.getCodeVerification(email, domain);
        if (verifyCode) {
          const verifyResponse = await this.verifyAccount(verifyCode);
          if (verifyResponse) {
            const token = await this.loginUser(email, password);
            if (token) {
              const providers = await this.generateProvider(token);
              if (providers && providers.length > 0) {
                return {
                  registration: {
                    email: email,
                    password: password,
                  },
                  token: token,
                  providers: providers,
                };
              }
            } else {
              return {
                registration: {
                  email: email,
                  password: password,
                },
              };
            }
          }
        }
      }
      return null;
    } catch (error) {
      logMessage(
        this.currentNum,
        this.total,
        `Error proses register, message : ${error.message}`,
        "error"
      );
      return null;
    }
  }
};
