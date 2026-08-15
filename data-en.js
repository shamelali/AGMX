// AGMX Mock Data — simulates a Malaysian cooperative governance system
// All names and figures are fictitious, used for demonstration only.

window.MC_DATA = {
  cooperative: {
    id: "KPM-2024-00142",
    name: "Koperasi Pekerja Maju Berhad",
    shortName: "KOPEMAJU",
    registrationNo: "KPM-142/2010",
    state: "Selangor",
    zone: "Petaling Jaya",
    members: 1284,
    quorumPct: 25,
    quorumRequired: 322,
    uukRef: "UUK/2018/v3.2",
    logoText: "KM",
    logoColor: "#0B5394",
    founded: "2010",
    plan: "Enterprise",
    renewalDate: "31 Disember 2026",
  },

  currentUser: {
    id: "U-0042",
    name: "Mrs. Aishah Rahman",
    role: "Secretary",
    avatar: "AR",
    memberId: "A-0042",
    phone: "+60 12-*** 8821",
    email: "aishah@kopemaju.my",
    language: "BM",
  },

  members: [
    { id: "A-0042", name: "Mrs. Aishah Rahman", ic: "80****-**-****", shares: 1200, status: "Active", arrears: 0, eligible: true, age: 56, proxy: null, attended: true, joined: "2012-03-14" },
    { id: "A-0117", name: "Mr. Lim Chong Wei", ic: "71****-**-****", shares: 850, status: "Active", arrears: 0, eligible: true, age: 49, proxy: null, attended: true, joined: "2014-07-02" },
    { id: "A-0233", name: "Ms. Nurul Huda Bt Ali", ic: "92****-**-****", shares: 600, status: "Active", arrears: 0, eligible: true, age: 32, proxy: null, attended: true, joined: "2019-01-22" },
    { id: "A-0078", name: "Mr. Muthusamy a/l Gopal", ic: "65****-**-****", shares: 2400, status: "Active", arrears: 0, eligible: true, age: 71, proxy: "A-0233", attended: true, joined: "2008-05-09" },
    { id: "A-0312", name: "Mrs. Fatimah Bt Ismail", ic: "68****-**-****", shares: 1500, status: "Active", arrears: 0, eligible: true, age: 73, proxy: null, attended: true, joined: "2010-11-30" },
    { id: "A-0044", name: "Mr. Razak Bin Hussein", ic: "75****-**-****", shares: 900, status: "Arrears", arrears: 240, eligible: false, age: 48, proxy: null, attended: false, joined: "2015-04-18" },
    { id: "A-0201", name: "Ms. Tan Mei Ling", ic: "94****-**-****", shares: 300, status: "Active", arrears: 0, eligible: true, age: 30, proxy: null, attended: true, joined: "2021-08-01" },
    { id: "A-0099", name: "Mr. Vijay Kumar", ic: "70****-**-****", shares: 1750, status: "Active", arrears: 0, eligible: true, age: 52, proxy: null, attended: true, joined: "2011-02-19" },
    { id: "A-0067", name: "Mrs. Saraswathi Devi", ic: "62****-**-****", shares: 2200, status: "Active", arrears: 0, eligible: true, age: 68, proxy: "A-0099", attended: true, joined: "2009-09-25" },
    { id: "A-0089", name: "Mr. Faizal Bin Ahmad", ic: "78****-**-****", shares: 1100, status: "Arrears", arrears: 180, eligible: false, age: 45, proxy: null, attended: false, joined: "2013-06-12" },
    { id: "A-0156", name: "Mrs. Wong Soke Yen", ic: "85****-**-****", shares: 1450, status: "Active", arrears: 0, eligible: true, age: 39, proxy: null, attended: true, joined: "2016-10-05" },
    { id: "A-0287", name: "Mr. Mohd Firdaus", ic: "88****-**-****", shares: 800, status: "Active", arrears: 0, eligible: true, age: 36, proxy: null, attended: true, joined: "2018-12-08" },
    { id: "A-0501", name: "Mrs. Zaiton Bt Mohd", ic: "60****-**-****", shares: 2600, status: "Active", arrears: 0, eligible: true, age: 75, proxy: "A-0312", attended: true, joined: "2007-03-22" },
  ],

  agm: {
    id: "AGM-2026-001",
    title: "16th Annual General Meeting",
    edition: "16th AGM (Financial Year 2025)",
    date: "23 Jun 2026",
    time: "09:00 – 13:00",
    venue: "KOPEMAJU Corporate Hall, Petaling Jaya",
    mode: "Hybrid (Physical + Online)",
    status: "LIVE",
    startedAt: "09:04",
    elapsed: "02:18:42",
    quorumPct: 31.4,
    quorumRequired: 322,
    quorumPresent: 403,
    totalMembers: 1284,
    lateNoticeDays: 21,
    noticesSent: 1284,
    noticesRead: 1197,
    noticesOpened: 1241,
  },

  agenda: [
    { id: "AG-01", title: "Chairmanship & Welcome Address", type: "Opening", duration: 10, status: "Completed", presenter: "Chairman" },
    { id: "AG-02", title: "Quorum & Meeting Notice Confirmation", type: "Compliance", duration: 5, status: "Completed", presenter: "Secretary" },
    { id: "AG-03", title: "Confirmation of 15th AGM Minutes", type: "Resolution", duration: 10, status: "Completed", presenter: "Secretary" },
    { id: "AG-04", title: "Presentation of 2025 Financial Statements", type: "Financial", duration: 25, status: "Completed", presenter: "Treasurer" },
    { id: "AG-05", title: "Annual Report & Achievements", type: "Report", duration: 20, status: "Completed", presenter: "Chairman" },
    { id: "AG-06", title: "Dividendd & Surplus Distribution", type: "Resolution", duration: 30, status: "In Progress", presenter: "Treasurer" },
    { id: "AG-07", title: "Board of Directors Election 2026-2029", type: "Election", duration: 45, status: "Waiting", presenter: "Commission" },
    { id: "AG-08", title: "Members' Motions", type: "Motions", duration: 30, status: "Waiting", presenter: "Member" },
    { id: "AG-09", title: "Other Matters & Closing", type: "Closing", duration: 10, status: "Waiting", presenter: "Chairman" },
  ],

  candidates: [
    { id: "C-01", name: "Mr. Lim Chong Wei", age: 49, position: "Chairman", votes: 287, manifesto: "Empowering cooperative digitalization & member well-being.", photo: "LC", color: "#0B5394", zone: "PJ Utara" },
    { id: "C-02", name: "Mrs. Wong Soke Yen", age: 39, position: "Deputy Chairman", votes: 198, manifesto: "Product innovation & expanding the youth market.", photo: "WS", color: "#7B1FA2", zone: "PJ Selatan" },
    { id: "C-03", name: "Mr. Muthusamy Gopal", age: 71, position: "Board Member", votes: 165, manifesto: "Preserving heritage & financial integrity.", photo: "MG", color: "#10B981", zone: "Petaling" },
    { id: "C-04", name: "Ms. Nurul Huda Ali", age: 32, position: "Board Member", votes: 224, manifesto: "Introducing an e-commerce platform for members.", photo: "NH", color: "#F59E0B", zone: "Subang" },
    { id: "C-05", name: "Mrs. Saraswathi Devi", age: 68, position: "Board Member", votes: 142, manifesto: "Strengthening women's cooperative & community networks.", photo: "SD", color: "#E91E63", zone: "PJ Timur" },
    { id: "C-06", name: "Mr. Vijay Kumar", age: 52, position: "Board Member", votes: 178, manifesto: "Entrepreneurship training & human capital.", photo: "VK", color: "#2196F3", zone: "Shah Alam" },
    { id: "C-07", name: "Mrs. Fatimah Ismail", age: 73, position: "Board Member", votes: 119, manifesto: "Healthcare services & veteran welfare.", photo: "FI", color: "#9C27B0", zone: "Klang" },
    { id: "C-08", name: "Mr. Mohd Firdaus", age: 36, position: "Board Member", votes: 156, manifesto: "Technology transformation & cybersecurity.", photo: "MF", color: "#FF5722", zone: "PJ Barat" },
  ],

  motions: [
    {
      id: "M-001", title: "8% Dividendd Distribution from RM1.42 Million Net Surplus",
      proposer: "A-0099 (Mr. Vijay Kumar)", seconder: "A-0156 (Mrs. Wong Soke Yen)",
      status: "Voting Open", type: "Financial",
      proposedAt: "11:24:18", secondedAt: "11:25:02",
      discussion: [
        { who: "A-0078", name: "Mr. Muthusamy", text: "I fully support this — the 8% dividend rate is reasonable.", at: "11:30" },
        { who: "A-0501", name: "Mrs. Zaiton (oleh proxy)", text: "Could you explain the calculation formula?", at: "11:34" },
      ],
      votes: { ya: 248, tidak: 47, abstain: 18, total: 313 },
    },
    {
      id: "M-002", title: "Appointment of Certified External Auditor for FY 2026",
      proposer: "A-0117 (Mr. Lim)", seconder: "A-0099 (Mr. Vijay)", status: "Completed — PASSED", type: "Governance",
      proposedAt: "10:42:18", secondedAt: "10:43:55",
      discussion: [], votes: { ya: 381, tidak: 12, abstain: 8, total: 401 },
    },
    {
      id: "M-003", title: "UUK Clause 7.3 Amendment: General Meeting Quorum",
      proposer: "A-0042 (Mrs. Aishah)", seconder: null, status: "Failed — No Seconder", type: "UUK",
      proposedAt: "10:55:30", secondedAt: null, discussion: [], votes: null,
    },
  ],

  questions: [
    { id: "Q-01", from: "A-0078 (Mr. Muthusamy)", text: "Why is the dividend rate lower than FY 2024 (10%)?", category: "Financial", upvotes: 47, status: "Answered", answeredBy: "Treasurer" },
    { id: "Q-02", from: "A-0312 (Mrs. Fatimah)", text: "Will the cooperative open a branch in Klang?", category: "Strategik", upvotes: 23, status: "Merged", grouped: 12 },
    { id: "Q-03", from: "A-0501 (Mrs. Zaiton)", text: "How does the emergency financial aid mechanism for members work?", category: "Kebajikan", upvotes: 18, status: "In Queue", grouped: 4 },
    { id: "Q-04", from: "A-0287 (Mr. Firdaus)", text: "Could you explain the new property investment in Cyberjaya?", category: "Pelaburan", upvotes: 31, status: "Answered", answeredBy: "Treasurer" },
  ],

  actions: [
    { id: "ACT-001", title: "Complete external auditor appointment & sign engagement letter", pic: "Treasurer", due: "30 Jun 2026", status: "Completed", fromMotion: "M-002" },
    { id: "ACT-002", title: "Distribute 8% dividend to member accounts via eWallet", pic: "Finance Department", due: "15 Julai 2026", status: "In Action", fromMotion: "M-001" },
    { id: "ACT-003", title: "Prepare UUK 7.3 amendment working paper for the 17th AGM", pic: "Secretary", due: "31 Dis 2026", status: "Not Started", fromMotion: "M-003" },
  ],

  auditLog: [
    { ts: "11:42:18.243", actor: "A-0099", action: "VOTE_CAST", detail: "YES vote on M-001", hash: "0x9f4a…b8c2", ip: "10.0.4.117", sig: "✓" },
    { ts: "11:42:17.892", actor: "A-0156", action: "VOTE_CAST", detail: "NO vote on M-001", hash: "0x9f4a…b8c1", ip: "10.0.4.156", sig: "✓" },
    { ts: "11:42:16.110", actor: "A-0078", action: "VOTE_CAST", detail: "YES vote on M-001", hash: "0x9f4a…b8bf", ip: "10.0.5.078", sig: "✓" },
    { ts: "11:25:02.541", actor: "A-0156", action: "MOTION_SECOND", detail: "Seconded M-001", hash: "0x9f4a…b8bd", ip: "10.0.4.156", sig: "✓" },
    { ts: "11:24:18.022", actor: "A-0099", action: "MOTION_PROPOSE", detail: "Proposed M-001 (8% Dividendd)", hash: "0x9f4a…b8bb", ip: "10.0.4.099", sig: "✓" },
    { ts: "11:18:09.310", actor: "Chairman", action: "STAGE_CHANGE", detail: "Opened Voting Mode phase", hash: "0x9f4a…b8b7", ip: "—", sig: "✓" },
    { ts: "11:00:00.001", actor: "Secretary", action: "AGM_START", detail: "Meeting started, quorum confirmed", hash: "0x9f4a…b8b0", ip: "10.0.1.002", sig: "✓" },
  ],

  health: {
    cpu: 38, ram: 54, bandwidth: 67, db: 22,
    activeSessions: 403, queuedOTPs: 0, wsLatency: 142,
    alerts: [],
  },

  compliance: {
    score: 98,
    aktaChips: [
      { id: "Sec 17", label: "Meeting Notice (≥15 days)", status: "COMPLIANT", evidence: "21 days — sent 02 Jun 2026" },
      { id: "Sec 22", label: "Active Member Voting Eligibility", status: "COMPLIANT", evidence: "Auto-filtered (1,162 eligible / 122 ineligible)" },
      { id: "GP14", label: "Minimum Quorum (≥25%)", status: "COMPLIANT", evidence: "31.4% — 403 of 1,284 members" },
      { id: "GP14B", label: "Motion Proposer & Seconder", status: "COMPLIANT", evidence: "Every motion tracked automatically" },
      { id: "UUK 7.3", label: "Debate Duration", status: "WARNING", evidence: "1 motion exceeded 15 minutes on M-001" },
      { id: "Akta 1993", label: "Digital Records Cannot Be Deleted", status: "COMPLIANT", evidence: "Immutable hash chain active" },
    ],
  },

  financialSummary: {
    revenue: "RM 12.84 Million",
    netProfit: "RM 1.42 Million",
    dividend: "8%",
    totalAssets: "RM 38.20 Million",
    totalLiabilities: "RM 9.65 Million",
    yoyProfit: "+12.4%",
  },

  languages: ["Bahasa Melayu", "English", "Bahasa Indonesia", "தமிழ் (Tamil)", "中文 (Chinese)"],
};
