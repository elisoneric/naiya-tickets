export interface KBArticle {
  id: string;
  topic: string;
  keywords: string[];
  resolutionText: string;
  link?: string;
}

export const knowledgeBase: KBArticle[] = [
  {
    id: "kb-001",
    topic: "Device Onboarding & Activation",
    keywords: ["onboarding", "activation", "device", "activate", "setup"],
    resolutionText: "For Device Onboarding/Activation, please use the following exact details:\n\nAdmin First Name: Yahaya\nSurname: Olajide\nNIN: 18050024425\nPhone: 09033666669\nEmail: olajideyahayahammed@naiyatechnology.org\nESA: NA'IYA TECHNOLOGY SOLUTIONS LTD\nESA CODE: 437",
    link: "https://docs.google.com/forms/d/e/1FAIpQLSeSKPdSgAbAkJDC6vORXiKCmNPH2Kj7r5nMW90ai9_Tv_Ganw/viewform"
  },
  {
    id: "kb-002",
    topic: "Post-Onboarding & Production Switch",
    keywords: ["production", "switch", "post-onboarding", "post onboarding", "test runs"],
    resolutionText: "To complete your post-onboarding production switch, please do exactly 3 test runs and then fill out the completion form linked below.",
    link: "https://docs.google.com/forms/d/e/1FAIpQLSeqpetDm8DH8wtlmu4SkiUhpp1VEsQToIxsEqitqVRoF5b4kg/viewform"
  },
  {
    id: "kb-003",
    topic: "Device Damage, Loss or Theft",
    keywords: ["damage", "loss", "theft", "broken", "stolen", "lost"],
    resolutionText: "For device damage, loss, or theft, please send an email to Customercaretransitioning@naiyatechnology.org. Please CC Abubakaribrahimolose@naiyatechnlogy.org and Naiyatransitioningcustomercare@gmail.com.",
    link: "mailto:Customercaretransitioning@naiyatechnology.org?cc=Abubakaribrahimolose@naiyatechnlogy.org,Naiyatransitioningcustomercare@gmail.com&subject=Device%20Damage/Loss/Theft%20Report"
  },
  {
    id: "kb-004",
    topic: "Reactivation & Workflow Issues",
    keywords: ["reactivation", "workflow", "reactivate", "stuck"],
    resolutionText: "If you are facing reactivation or workflow issues, please fill out the dedicated support form.",
    link: "https://docs.google.com/forms/d/e/1FAIpQLSdQuZlgQRqv6bHBaoMByY6JoZhESex7c4VxN1A3TDvLoCojQw/viewform"
  },
  {
    id: "kb-005",
    topic: "Training Registration",
    keywords: ["training", "register", "registration", "classes"],
    resolutionText: "To register for training, please complete the training registration form linked below.",
    link: "https://docs.google.com/forms/d/e/1FAIpQLSfxWbHiyCebu0lCrsEzVd6nlhhsClraKYN-VY7bx0Sj6-BOZw/viewform"
  },
  {
    id: "kb-006",
    topic: "Blacklist Resolution",
    keywords: ["blacklist", "blocked", "suspended", "blacklisted"],
    resolutionText: "To resolve a blacklist issue, please submit an appeal via the blacklist resolution form.",
    link: "https://docs.google.com/forms/d/e/1FAIpQLSftewnstHxw8sZvZA2JVRarpoaqYAQnVHv-2z-Jh6S_TvnGDQ/viewform"
  }
];
