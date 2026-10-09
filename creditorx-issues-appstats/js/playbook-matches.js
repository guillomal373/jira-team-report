// Playbook theme matches used by topic insights.

const PLAYBOOK_THEME_MATCHES = {
  "First Login": [
    {
      category: "First Login",
      articles: [
        "First time steps",
        "Forth's CRM phone number is a landline number",
        "Associated phone number is missing",
        "Account already created",
        "Invalid credentials — Account ID (External ID)",
        "They cannot create the password",
      ],
    },
  ],
  Login: [
    {
      category: "Login",
      articles: [
        "Does not know the username",
        "Reset password",
        "Update email or phone number",
        "Frozen screen or screen that suddenly closes",
      ],
    },
  ],
  "Phone Number & External Data": [
    {
      category: "First Login",
      articles: [
        "Associated phone number is missing",
        "Forth's CRM phone number is a landline number",
      ],
    },
    {
      category: "Login",
      articles: ["Update email or phone number"],
    },
  ],
  "Verification Code & Message Delivery": [
    {
      category: "First Login",
      articles: ["First time steps"],
    },
    {
      category: "Login",
      articles: ["Reset password", "Update email or phone number"],
    },
  ],
  "Identity Validation & DOB": [
    {
      category: "First Login",
      articles: [
        "First time steps",
        "Invalid credentials — Account ID (External ID)",
      ],
    },
    {
      category: "Login",
      articles: ["Reset password"],
    },
  ],
  "USSD & Carrier Setup": [
    {
      category: "Redirecting Setup",
      articles: [
        "Carriers and Providers",
        "Sending USSD commands",
        "USSD codes — checkbox cannot be clicked",
        "Calls are not being forwarded",
      ],
    },
  ],
  "Call Blocking & Creditor Numbers": [
    {
      category: "Redirecting Setup",
      articles: [
        "Verify or reject a phone number",
        "Calls are not being forwarded",
        "Sending USSD commands",
      ],
    },
  ],
  "App Flow, Buttons & Freezes": [
    {
      category: "Login",
      articles: ["Frozen screen or screen that suddenly closes"],
    },
    {
      category: "Redirecting Setup",
      articles: ["USSD codes — checkbox cannot be clicked"],
    },
  ],
  "Install, Reinstall & App Version": [
    {
      category: "Login",
      articles: ["Frozen screen or screen that suddenly closes"],
    },
    {
      category: "Voicemails",
      articles: ["Can't find my voicemails", "Can't hear my voicemails"],
    },
    {
      category: "General",
      articles: ["When they indicate errors but without information"],
    },
  ],
  "Contacts & Device Permissions": [
    {
      category: "Redirecting Setup",
      articles: [
        "Calls are not being forwarded",
        "USSD codes — checkbox cannot be clicked",
      ],
    },
  ],
  "Calls Not Being Blocked": [
    {
      category: "Blocked List",
      articles: ["Calls are not being forwarded"],
    },
  ],
  "Numbers Under Review & Add Creditor Failures": [
    {
      category: "Blocked List",
      articles: ["When they indicate errors but without information"],
    },
  ],
  "Voicemail Blocked": [
    {
      category: "Redirecting Setup",
      articles: ["Calls are not being forwarded"],
    },
  ],
  "Generic Error & Missing Details": [
    {
      category: "General",
      articles: ["When they indicate errors but without information"],
    },
  ],
  "Other / Needs AI Review": [
    {
      category: "General",
      articles: ["When they indicate errors but without information"],
    },
  ],
};
