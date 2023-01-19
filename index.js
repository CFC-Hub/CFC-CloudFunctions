const functions = require("firebase-functions");
const express = require("express");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const cors = require("cors");
const app = express();
app.use(cors({ origin: true }));
var admin = require("firebase-admin");
var serviceAccount = require("./cfc-trublo.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
app.use(cors({ origin: true }));

const verifyToken = (req, res, next) => {
  const bearerHeader = req.headers["authorization"];
  if (bearerHeader != undefined) {
    const bearer = bearerHeader.split(" ");
    const bearerToken = bearer[1];
    admin
      .auth()
      .verifyIdToken(bearerToken)
      .then(function (decodedToken) {
        next();
      })
      .catch(function (error) {
        res.status(401).send("Unauthorized user");
      });
  } else {
    res.status(403).send("Please send authorization token");
  }
};

app.use(verifyToken);

app.get("/", (req, res) => {
  res.send("Welcome");
});
var transporter = nodemailer.createTransport({
  service: "gmail",

  auth: {
    user: process.env.USER,
    pass: process.env.PASSWORD,
  },
});

app.post("/send-otp", async (req, res) => {
  const { email } = req.body;
  var text = "";

  const otp = Math.floor(1000 + Math.random() * 9000);
  var char_list = "abcdefghijklmnopqrstuvwxyz";
  for (var i = 0; i < 2; i++) {
    text += char_list.charAt(Math.floor(Math.random() * char_list.length));
  }
  var otpText = String(otp) + text;
  let arr = otpText.split("");
  var arr_len = arr.length;
  while (arr_len) {
    let digit = Math.floor(Math.random() * arr_len--);
    [arr[arr_len], arr[digit]] = [arr[digit], arr[arr_len]];
  }
  var newOtpText = arr.join("");

  const userdata = {
    otp: newOtpText,
    email: email,
    createdTimestamp: Date.now(),
  };
  const response = await admin
    .firestore()
    .collection("userOTP")
    .doc()
    .set(userdata);
  console.log("response", response);
  const mailData = {
    from: process.env.USER, // sender address
    to: email,
    subject: " Your CFC OTP for email verification",
    text: "text",
    html: `<b>Hi, </b><br> Please use below OTP in the CFC app to verify your email address ${newOtpText} <br/><br><b>Thank You!!<b/><br/>`,
  };

  transporter.sendMail(mailData, (error, info) => {
    if (error) {
      return console.log(error);
    }
    res.status(200).send({ message: "Mail send", message_id: info.messageId });
  });
});

app.post("/verify-otp", async (req, res) => {
  const { email } = req.body;
  const { otp } = req.body;

  const response = await admin
    .firestore()
    .collection("userOTP")
    .where("email", "==", email)
    .where("otp", "==", otp)
    .get();

  // console.log("FireStore:", response.docs[0].data());
  // console.log("Length:", response.docs.length);

  if (response.docs.length > 0)
    res.status(200).send({ message: "OTP Verified" });
  else res.status(200).send({ message: "Cannot Verify OTP" });
});

exports.app = functions.https.onRequest(app);
