import { useEffect, useRef, useState } from "react";
import "./App.css";
import { supabase } from "./supabaseClient";
import AcupressureExercise from "./components/AcupressureExercise";
import AcupressureSelection from "./components/AcupressureSelection";
import pc6WristCalm from "./assets/acupressure/pc6-wrist-calm.png";
import kd27ChestCalm from "./assets/acupressure/kd27-chest-calm.png";
import yintangMindCalm from "./assets/acupressure/yintang-mind-calm.png";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

export function calculateAverageAnxietyReduction(sessions) {
  if (!Array.isArray(sessions)) return null;

  const seenSessionIds = new Set();
  const reductions = [];

  sessions.forEach((session) => {
    if (!session || (session.interventionType && session.interventionType !== "craving_reset")) return;
    if (session.id && seenSessionIds.has(session.id)) return;
    if (session.id) seenSessionIds.add(session.id);
    if (!Number.isFinite(session.anxietyBefore) || !Number.isFinite(session.anxietyAfter)) return;
    reductions.push(session.anxietyBefore - session.anxietyAfter);
  });

  if (reductions.length === 0) return null;
  return (
    reductions.reduce((total, reduction) => total + reduction, 0) /
    reductions.length
  ).toFixed(1);
}

export function getAnxietyChangeMessage(anxietyBefore, anxietyAfter) {
  if (!Number.isFinite(anxietyBefore) || !Number.isFinite(anxietyAfter)) return null;
  if (anxietyAfter < anxietyBefore) return `Anxiety decreased from ${anxietyBefore} to ${anxietyAfter}.`;
  if (anxietyAfter > anxietyBefore) return `Anxiety increased from ${anxietyBefore} to ${anxietyAfter}.`;
  return `Anxiety stayed the same at ${anxietyBefore}.`;
}

export function getCravingChangeMessage(cravingBefore, cravingAfter) {
  if (!Number.isFinite(cravingBefore) || !Number.isFinite(cravingAfter)) return null;
  if (cravingAfter < cravingBefore) return `Craving decreased from ${cravingBefore} to ${cravingAfter}.`;
  if (cravingAfter > cravingBefore) return `Craving increased from ${cravingBefore} to ${cravingAfter}.`;
  return `Craving stayed the same at ${cravingBefore}.`;
}

function readSessionLog() {
  try {
    const savedSessions = JSON.parse(localStorage.getItem("sessionLog") || "[]");
    return Array.isArray(savedSessions) ? savedSessions : [];
  } catch (error) {
    console.error("Unable to read local RESET history:", error);
    return [];
  }
}

function App({ environment = process.env.NODE_ENV, currentUser = null }) {
  const isDevelopmentPreview =
    process.env.NODE_ENV === "development" ||
    (process.env.NODE_ENV === "test" && environment === "development");
  //console.log("Supabase connected:", supabase);
  const [phase, setPhase] = useState("Inhale");
  const [timer, setTimer] = useState(4);
  const [step, setStep] = useState("home");
  // Local-development preview only; this is not authentication. Production
  // administrator access must use Supabase Auth and role-based authorization.
  const [previewRole, setPreviewRole] = useState(() => {
    if (!isDevelopmentPreview) return "consumer";
    const storedRole = localStorage.getItem("pulsewell_preview_role");
    return storedRole === "consumer" || storedRole === "admin"
      ? storedRole
      : "consumer";
  });
  const isAdmin = isDevelopmentPreview && previewRole === "admin";
  const [beforeScore, setBeforeScore] = useState(null);
  const [afterScore, setAfterScore] = useState(null);
  const [sessionLog, setSessionLog] = useState([]);
  const [saveStatus, setSaveStatus] = useState("idle");
  const resetSavedRef = useRef(false);
  const resetSessionIdRef = useRef(null);
  const [selectedAction, setSelectedAction] = useState("");
  const [wins, setWins] = useState("");
 const [challenge, setChallenge] = useState("");
 const [tomorrowFocus, setTomorrowFocus] = useState("");
 const [reviewSaved, setReviewSaved] = useState(false);

 const [mood, setMood] = useState("");
 const [anxietyBefore, setAnxietyBefore] = useState(null);
 const [anxietyAfter, setAnxietyAfter] = useState(null);
 const [cravingBeforeAcupressure, setCravingBeforeAcupressure] = useState(null);
 const [stressBeforeAcupressure, setStressBeforeAcupressure] = useState(null);
 const [cravingAfterAcupressure, setCravingAfterAcupressure] = useState(null);
 const [stressAfterAcupressure, setStressAfterAcupressure] = useState(null);
 const [interventionType, setInterventionType] = useState(null);
 const [acupressureExercise, setAcupressureExercise] = useState(null);
 const [acupressureCompleted, setAcupressureCompleted] = useState(false);
 const [acupressureCompletedAt, setAcupressureCompletedAt] = useState(null);
 const [acupressureReturnStep, setAcupressureReturnStep] = useState("home");
 const [wakeTime, setWakeTime] = useState("7:00");
 const [block, setBlock] = useState("Gym / Work / Walk");
 const [connection, setConnection] = useState("Call / Meeting / Visit");
 const [todayStructurePlan, setTodayStructurePlan] = useState(null);
 const [customAction1, setCustomAction1] = useState("");
 const [customAction2, setCustomAction2] = useState("");
 const [selectedChannel, setSelectedChannel] = useState("");
 const [nightlyReviewCount, setNightlyReviewCount] = useState(
  JSON.parse(localStorage.getItem("nightlyReview"))?.length || 0
);
const [cloudSessions, setCloudSessions] = useState([]);
 const changePreviewRole = (nextRole) => {
  if (!isDevelopmentPreview || !["consumer", "admin"].includes(nextRole)) return;
  setPreviewRole(nextRole);
  localStorage.setItem("pulsewell_preview_role", nextRole);
  if (nextRole === "consumer" && step === "analytics") setStep("home");
 };
 // ✅ LOAD SAVED DATA FIRST
useEffect(() => {
  const savedWake = localStorage.getItem("wakeTime");
  const savedBlock = localStorage.getItem("block");
  const savedConnection = localStorage.getItem("connection");
  
 

  if (savedWake) setWakeTime(savedWake);
  if (savedBlock) setBlock(savedBlock);
  if (savedConnection) setConnection(savedConnection);
  setSessionLog(readSessionLog());
  const todayKey = new Date().toLocaleDateString("en-CA");
  const savedPlans = JSON.parse(localStorage.getItem("structurePlans") || "[]");
  if (Array.isArray(savedPlans)) {
    const planForToday = savedPlans.find((plan) => plan.dateKey === todayKey);
    if (planForToday) {
      setTodayStructurePlan(planForToday);
      setWakeTime(planForToday.wakeTime);
      setBlock(planForToday.block);
      setConnection(planForToday.connection);
    }
  }
}, []);
useEffect(() => {
  if (step === "analytics" && !isAdmin) setStep("home");
}, [isAdmin, step]);
  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev > 1) return prev - 1;

        let nextPhase =
          phase === "Inhale"
            ? "Hold"
            : phase === "Hold"
            ? "Exhale"
            : "Inhale";

        setPhase(nextPhase);

        if (nextPhase === "Hold") return 2;
        if (nextPhase === "Exhale") return 4;
        return 4;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [phase]);
const beginCravingReset = () => {
  resetSavedRef.current = false;
  resetSessionIdRef.current = crypto.randomUUID();
  setBeforeScore(null);
  setAfterScore(null);
  setAnxietyBefore(null);
  setAnxietyAfter(null);
  setSelectedAction("");
  setSaveStatus("idle");
  setStep("before");
};
const updateLocalSessionSyncStatus = (sessionId, syncStatus) => {
  const updatedSessions = readSessionLog().map((session) =>
    (session.sessionId || session.id) === sessionId
      ? { ...session, syncStatus }
      : session
  );
  localStorage.setItem("sessionLog", JSON.stringify(updatedSessions));
  setSessionLog(updatedSessions);
};
const getCloudPayload = (session) => ({
  session_id: session.sessionId || session.id,
  craving_before: session.beforeScore,
  craving_after: session.afterScore,
  stress_before: session.anxietyBefore,
  stress_after: session.anxietyAfter,
  stress_level: session.anxietyAfter,
  mood: session.mood || null,
  source: "pulsewell_mvp",
  device_id: session.deviceId,
  client_completed_at: session.completedAt,
  intervention_type: "craving_reset",
  user_id: currentUser?.id ?? null
});
const saveCravingSession = async (session) => {
  const { error } = await supabase
    .from("session_results")
    .insert([getCloudPayload(session)]);

  if (error && error.code !== "23505") throw error;
};
const finishCloudSave = async (session, { showElevatedFallback = false } = {}) => {
  setSaveStatus("saving");
  setStep("saving");

  try {
    await saveCravingSession(session);
    updateLocalSessionSyncStatus(session.sessionId, "synced");
    setSaveStatus("synced");
    setStep(
      showElevatedFallback && (session.afterScore >= 7 || session.anxietyAfter >= 7)
        ? "elevated-fallback"
        : "done"
    );
  } catch (error) {
    console.error("Supabase insert error:", error);
    updateLocalSessionSyncStatus(session.sessionId, "failed");
    setSaveStatus("failed");
    setStep("done");
  }
};
const saveCompletedReset = async () => {
  if (resetSavedRef.current) return false;

  const resetId = resetSessionIdRef.current || crypto.randomUUID();
  const existingSessions = readSessionLog();

  if (existingSessions.some((session) => session.id === resetId)) {
    resetSavedRef.current = true;
    return false;
  }

  const completedAt = new Date();
  const newSession = {
    id: resetId,
    sessionId: resetId,
    date: completedAt.toLocaleString(),
    completedAt: completedAt.toISOString(),
    interventionType: "craving_reset",
    beforeScore,
    afterScore,
    reduction:
      beforeScore !== null && afterScore !== null
        ? beforeScore - afterScore
        : null,
    mood: mood || null,
    stressLevel: anxietyAfter,
    anxietyBefore,
    anxietyAfter,
    anxietyReduction:
      anxietyBefore !== null && anxietyAfter !== null
        ? anxietyBefore - anxietyAfter
        : null,
    selectedAction,
    deviceId: getDeviceId(),
    syncStatus: "pending"
  };

  const updatedSessions = [...existingSessions, newSession];

  setSessionLog(updatedSessions);
  localStorage.setItem("sessionLog", JSON.stringify(updatedSessions));
  resetSavedRef.current = true;
  resetSessionIdRef.current = resetId;
  await finishCloudSave(newSession, { showElevatedFallback: true });
  return true;
};
const retryCloudSave = async () => {
  const sessionId = resetSessionIdRef.current;
  const session = readSessionLog().find(
    (savedSession) => (savedSession.sessionId || savedSession.id) === sessionId
  );
  if (!session) return;
  await finishCloudSave({ ...session, sessionId });
};
const saveStructurePlan = () => {
  const dateKey = new Date().toLocaleDateString("en-CA");
  const savedPlans = JSON.parse(localStorage.getItem("structurePlans") || "[]");
  const existingPlans = Array.isArray(savedPlans) ? savedPlans : [];
  const plan = {
    dateKey,
    completedAt: new Date().toISOString(),
    wakeTime,
    block,
    connection
  };
  const updatedPlans = [
    ...existingPlans.filter((savedPlan) => savedPlan.dateKey !== dateKey),
    plan
  ];
  localStorage.setItem("structurePlans", JSON.stringify(updatedPlans));
  localStorage.setItem("wakeTime", wakeTime);
  localStorage.setItem("block", block);
  localStorage.setItem("connection", connection);
  setTodayStructurePlan(plan);
};
const getDeviceId = () => {
  let deviceId = localStorage.getItem("pulsewell_device_id");

  if (!deviceId) {
    deviceId =
      "device_" + Math.random().toString(36).substring(2, 12);
    localStorage.setItem("pulsewell_device_id", deviceId);
  }

  return deviceId;
};
const averageReduction =
  sessionLog.length > 0
    ? (
        sessionLog.reduce(
          (sum, s) => sum + (s.reduction || 0),
          0
        ) / sessionLog.length
      ).toFixed(1)
    : 0;
const averageAnxietyReduction = calculateAverageAnxietyReduction(sessionLog);
    useEffect(() => {
      if (!isAdmin) return;
      const loadCloudSessions = async () => {
      console.log("Loading cloud sessions...");
  const { data, error } = await supabase
    .from("session_results")
    .select("*")
    
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading cloud sessions:", error);
    return;
  }

  setCloudSessions(data || []);
      };
      loadCloudSessions();
    }, [isAdmin]);
const cloudTotalSessions = cloudSessions.length;

const cloudAverageReduction =
  cloudSessions.length > 0
    ? (
        cloudSessions.reduce(
          (sum, session) =>
            sum +
            ((session.craving_before || 0) -
             (session.craving_after || 0)),
          0
        ) / cloudSessions.length
      ).toFixed(1)
    : 0;
const cloudSuccessfulSessions = cloudSessions.filter(
  (session) => session.craving_after < session.craving_before
).length;

const cloudSuccessRate =
  cloudSessions.length > 0
    ? Math.round(
        (cloudSuccessfulSessions / cloudSessions.length) * 100
      )
    : 0;

const cloudUserOutcomeTotals = cloudSessions.reduce((acc, session) => {
  if (session.device_id == null) return acc;

  const deviceId = String(session.device_id).trim();
  if (!deviceId) return acc;

  if (!acc[deviceId]) {
    acc[deviceId] = {
      beforeTotal: 0,
      beforeCount: 0,
      afterTotal: 0,
      afterCount: 0
    };
  }

  const cravingBefore = Number(session.craving_before);
  const cravingAfter = Number(session.craving_after);

  if (
    session.craving_before !== null &&
    session.craving_before !== undefined &&
    Number.isFinite(cravingBefore)
  ) {
    acc[deviceId].beforeTotal += cravingBefore;
    acc[deviceId].beforeCount += 1;
  }

  if (
    session.craving_after !== null &&
    session.craving_after !== undefined &&
    Number.isFinite(cravingAfter)
  ) {
    acc[deviceId].afterTotal += cravingAfter;
    acc[deviceId].afterCount += 1;
  }

  return acc;
}, {});

const cloudValidUserOutcomes = Object.values(cloudUserOutcomeTotals)
  .filter((user) => user.beforeCount > 0 && user.afterCount > 0)
  .map((user) => {
    const averageBefore = user.beforeTotal / user.beforeCount;
    const averageAfter = user.afterTotal / user.afterCount;

    return {
      averageBefore,
      averageAfter,
      averageChange: averageBefore - averageAfter
    };
  });

const cloudAverageUserCravingChange =
  cloudValidUserOutcomes.length > 0
    ? (
        cloudValidUserOutcomes.reduce(
          (sum, user) => sum + user.averageChange,
          0
        ) / cloudValidUserOutcomes.length
      ).toFixed(1)
    : null;

const cloudUsersShowingCravingImprovement =
  cloudValidUserOutcomes.length > 0
    ? Math.round(
        (cloudValidUserOutcomes.filter(
          (user) => user.averageAfter < user.averageBefore
        ).length /
          cloudValidUserOutcomes.length) *
          100
      )
    : null;
const cloudUniqueUsers = new Set(
  cloudSessions
    .map((session) => session.device_id)
    .filter(Boolean)
).size;

const cloudSessionsPerUser =
  cloudUniqueUsers > 0
    ? (cloudSessions.length / cloudUniqueUsers).toFixed(1)
    : 0;
   const cloudReturningUsers = Object.values(
  cloudSessions.reduce((acc, session) => {
    if (!session.device_id) return acc;

    acc[session.device_id] = (acc[session.device_id] || 0) + 1;
    return acc;
  }, {})
).filter((sessionCount) => sessionCount > 1).length;

const cloudReturningUserRate =
  cloudUniqueUsers > 0
    ? Math.round((cloudReturningUsers / cloudUniqueUsers) * 100)
    : 0;

const supportSignalsToday = cloudSessions.reduce(
  (signals, session) => {
    if (!session.created_at || session.device_id == null) return signals;

    const deviceId = String(session.device_id).trim();
    if (!deviceId) return signals;

    const sessionDate = new Date(session.created_at);
    if (Number.isNaN(sessionDate.getTime())) return signals;

    const today = new Date();
    const isToday =
      sessionDate.getFullYear() === today.getFullYear() &&
      sessionDate.getMonth() === today.getMonth() &&
      sessionDate.getDate() === today.getDate();

    if (!isToday) return signals;

    const cravingBefore = Number(session.craving_before);
    const stressLevelValue = Number(session.stress_level);
    const hasValidCraving =
      session.craving_before !== null &&
      session.craving_before !== undefined &&
      String(session.craving_before).trim() !== "" &&
      Number.isFinite(cravingBefore);
    const hasValidStress =
      session.stress_level !== null &&
      session.stress_level !== undefined &&
      String(session.stress_level).trim() !== "" &&
      Number.isFinite(stressLevelValue);
    const normalizedMood =
      typeof session.mood === "string"
        ? session.mood.trim().toLowerCase()
        : "";

    if (hasValidCraving && cravingBefore >= 8) {
      signals.elevatedCravingUsers.add(deviceId);
    }

    if (hasValidStress && stressLevelValue >= 8) {
      signals.elevatedStressUsers.add(deviceId);
    }

    if (
      normalizedMood === "low" &&
      hasValidCraving &&
      cravingBefore >= 7
    ) {
      signals.combinedSignalUsers.add(deviceId);
    }

    return signals;
  },
  {
    elevatedCravingUsers: new Set(),
    elevatedStressUsers: new Set(),
    combinedSignalUsers: new Set()
  }
);

const elevatedCravingUserCount = supportSignalsToday.elevatedCravingUsers.size;
const elevatedStressUserCount = supportSignalsToday.elevatedStressUsers.size;
const combinedSupportSignalUserCount =
  supportSignalsToday.combinedSignalUsers.size;

const engagementTodayStart = new Date();
engagementTodayStart.setHours(0, 0, 0, 0);
const engagementTomorrowStart = new Date(engagementTodayStart);
engagementTomorrowStart.setDate(engagementTomorrowStart.getDate() + 1);
const engagementThirtyDayStart = new Date(engagementTodayStart);
engagementThirtyDayStart.setDate(engagementThirtyDayStart.getDate() - 29);
const engagementSevenDayCutoff = new Date(engagementTodayStart);
engagementSevenDayCutoff.setDate(engagementSevenDayCutoff.getDate() - 7);

const engagementActivityByUser = cloudSessions.reduce((acc, session) => {
  if (!session.created_at || session.device_id == null) return acc;

  const deviceId = String(session.device_id).trim();
  if (!deviceId) return acc;

  const sessionDate = new Date(session.created_at);
  if (Number.isNaN(sessionDate.getTime())) return acc;

  if (
    sessionDate < engagementThirtyDayStart ||
    sessionDate >= engagementTomorrowStart
  ) {
    return acc;
  }

  if (!acc[deviceId]) {
    acc[deviceId] = {
      checkedInToday: false,
      mostRecentSession: sessionDate
    };
  }

  if (
    sessionDate >= engagementTodayStart &&
    sessionDate < engagementTomorrowStart
  ) {
    acc[deviceId].checkedInToday = true;
  }

  if (sessionDate > acc[deviceId].mostRecentSession) {
    acc[deviceId].mostRecentSession = sessionDate;
  }

  return acc;
}, {});

const eligibleEngagementUsers = Object.entries(engagementActivityByUser);

const noCheckInTodayUsers = new Set(
  eligibleEngagementUsers
    .filter(([, user]) => !user.checkedInToday)
    .map(([deviceId]) => deviceId)
);

const noCheckInSevenDaysUsers = new Set(
  eligibleEngagementUsers
    .filter(([, user]) => user.mostRecentSession < engagementSevenDayCutoff)
    .map(([deviceId]) => deviceId)
);

const engagementReengagementUsers = new Set([
  ...noCheckInTodayUsers,
  ...noCheckInSevenDaysUsers
]);

const noCheckInTodayUserCount = noCheckInTodayUsers.size;
const noCheckInSevenDaysUserCount = noCheckInSevenDaysUsers.size;
const engagementReengagementUserCount = engagementReengagementUsers.size;

const recoveryPatternsCurrentWeekStart = new Date(engagementTodayStart);
recoveryPatternsCurrentWeekStart.setDate(
  recoveryPatternsCurrentWeekStart.getDate() - 6
);
const recoveryPatternsPreviousWeekStart = new Date(engagementTodayStart);
recoveryPatternsPreviousWeekStart.setDate(
  recoveryPatternsPreviousWeekStart.getDate() - 13
);

const eligibleRecoveryPatternUserIds = new Set(
  eligibleEngagementUsers.map(([deviceId]) => deviceId)
);

const recoveryPatternActivityByUser = cloudSessions.reduce((acc, session) => {
  if (!session.created_at || session.device_id == null) return acc;

  const deviceId = String(session.device_id).trim();
  if (!deviceId || !eligibleRecoveryPatternUserIds.has(deviceId)) return acc;

  const sessionDate = new Date(session.created_at);
  if (Number.isNaN(sessionDate.getTime())) return acc;

  if (
    sessionDate < recoveryPatternsPreviousWeekStart ||
    sessionDate >= engagementTomorrowStart
  ) {
    return acc;
  }

  if (!acc[deviceId]) {
    acc[deviceId] = {
      currentWeekHighCravingSessions: 0,
      currentWeekHighStressSessions: 0,
      currentWeekCravings: [],
      previousWeekCravings: []
    };
  }

  const cravingBefore = Number(session.craving_before);
  const stressLevelValue = Number(session.stress_level);
  const hasValidCraving =
    session.craving_before !== null &&
    session.craving_before !== undefined &&
    String(session.craving_before).trim() !== "" &&
    Number.isFinite(cravingBefore);
  const hasValidStress =
    session.stress_level !== null &&
    session.stress_level !== undefined &&
    String(session.stress_level).trim() !== "" &&
    Number.isFinite(stressLevelValue);
  const isCurrentWeek = sessionDate >= recoveryPatternsCurrentWeekStart;

  if (isCurrentWeek) {
    if (hasValidCraving) {
      acc[deviceId].currentWeekCravings.push(cravingBefore);
      if (cravingBefore >= 8) {
        acc[deviceId].currentWeekHighCravingSessions += 1;
      }
    }

    if (hasValidStress && stressLevelValue >= 8) {
      acc[deviceId].currentWeekHighStressSessions += 1;
    }
  } else if (hasValidCraving) {
    acc[deviceId].previousWeekCravings.push(cravingBefore);
  }

  return acc;
}, {});

const recoveryPatternUsers = Object.values(recoveryPatternActivityByUser);
const repeatedHighCravingUserCount = recoveryPatternUsers.filter(
  (user) => user.currentWeekHighCravingSessions >= 2
).length;
const repeatedHighStressUserCount = recoveryPatternUsers.filter(
  (user) => user.currentWeekHighStressSessions >= 2
).length;
const improvingParticipantCount = recoveryPatternUsers.filter((user) => {
  if (
    user.currentWeekCravings.length === 0 ||
    user.previousWeekCravings.length === 0
  ) {
    return false;
  }

  const currentWeekAverage =
    user.currentWeekCravings.reduce((sum, value) => sum + value, 0) /
    user.currentWeekCravings.length;
  const previousWeekAverage =
    user.previousWeekCravings.reduce((sum, value) => sum + value, 0) /
    user.previousWeekCravings.length;

  return currentWeekAverage < previousWeekAverage;
}).length;
const recoveryPatternTotal =
  repeatedHighCravingUserCount +
  repeatedHighStressUserCount +
  noCheckInSevenDaysUserCount +
  improvingParticipantCount;

    const cloudLowMoodCount = cloudSessions.filter(
  (session) => session.mood === "Low"
).length;

const cloudNeutralMoodCount = cloudSessions.filter(
  (session) => session.mood === "Neutral"
).length;

const cloudGoodMoodCount = cloudSessions.filter(
  (session) => session.mood === "Good"
).length;

const cloudStressSessions = cloudSessions.filter(
  (session) =>
    session.stress_level !== null &&
    session.stress_level !== undefined &&
    Number.isFinite(Number(session.stress_level))
);

const averageStressLevel =
  cloudStressSessions.length > 0
    ? (
        cloudStressSessions.reduce(
          (sum, session) => sum + Number(session.stress_level),
          0
        ) / cloudStressSessions.length
      ).toFixed(1)
    : null;

const cloudMoodCounts = [
  { mood: "Low", count: cloudLowMoodCount },
  { mood: "Neutral", count: cloudNeutralMoodCount },
  { mood: "Good", count: cloudGoodMoodCount }
];

const cloudHighestMoodCount = Math.max(
  ...cloudMoodCounts.map((item) => item.count)
);

const cloudMostReportedMoods = cloudMoodCounts.filter(
  (item) => item.count === cloudHighestMoodCount
);

const mostReportedMood =
  cloudHighestMoodCount === 0
    ? "No data"
    : cloudMostReportedMoods.length > 1
    ? "Mixed"
    : cloudMostReportedMoods[0].mood;
const cloudLowMoodReduction =
  cloudSessions.filter((session) => session.mood === "Low").length > 0
    ? (
        cloudSessions
          .filter((session) => session.mood === "Low")
          .reduce(
            (sum, session) =>
              sum +
              ((session.craving_before || 0) -
                (session.craving_after || 0)),
            0
          ) /
        cloudSessions.filter((session) => session.mood === "Low").length
      ).toFixed(1)
    : 0;
    
    const cloudNeutralMoodReduction =
  cloudSessions.filter((session) => session.mood === "Neutral").length > 0
    ? (
        cloudSessions
          .filter((session) => session.mood === "Neutral")
          .reduce(
            (sum, session) =>
              sum +
              ((session.craving_before || 0) -
                (session.craving_after || 0)),
            0
          ) /
        cloudSessions.filter((session) => session.mood === "Neutral").length
      ).toFixed(1)
    : 0;
const cloudGoodMoodReduction =
  cloudSessions.filter((session) => session.mood === "Good").length > 0
    ? (
        cloudSessions
          .filter((session) => session.mood === "Good")
          .reduce(
            (sum, session) =>
              sum +
              ((session.craving_before || 0) -
                (session.craving_after || 0)),
            0
          ) /
        cloudSessions.filter((session) => session.mood === "Good").length
      ).toFixed(1)
    : 0;

const cravingTrendPerUserByDate = Object.values(
  cloudSessions.reduce((acc, session) => {
    if (!session.created_at || session.device_id == null) return acc;

    const deviceId = String(session.device_id).trim();
    if (!deviceId) return acc;

    const sessionDate = new Date(session.created_at);
    if (Number.isNaN(sessionDate.getTime())) return acc;

    const cravingBefore = Number(session.craving_before);
    const cravingAfter = Number(session.craving_after);
    const hasValidBefore =
      session.craving_before !== null &&
      session.craving_before !== undefined &&
      Number.isFinite(cravingBefore);
    const hasValidAfter =
      session.craving_after !== null &&
      session.craving_after !== undefined &&
      Number.isFinite(cravingAfter);

    if (!hasValidBefore && !hasValidAfter) return acc;

    const year = sessionDate.getFullYear();
    const month = String(sessionDate.getMonth() + 1).padStart(2, "0");
    const day = String(sessionDate.getDate()).padStart(2, "0");
    const dateKey = `${year}-${month}-${day}`;

    if (!acc[dateKey]) {
      acc[dateKey] = {
        dateKey,
        timestamp: new Date(year, sessionDate.getMonth(), sessionDate.getDate()).getTime(),
        users: {}
      };
    }

    if (!acc[dateKey].users[deviceId]) {
      acc[dateKey].users[deviceId] = {
        beforeTotal: 0,
        beforeCount: 0,
        afterTotal: 0,
        afterCount: 0
      };
    }

    const userDay = acc[dateKey].users[deviceId];

    if (hasValidBefore) {
      userDay.beforeTotal += cravingBefore;
      userDay.beforeCount += 1;
    }

    if (hasValidAfter) {
      userDay.afterTotal += cravingAfter;
      userDay.afterCount += 1;
    }

    return acc;
  }, {})
)
  .sort((a, b) => a.timestamp - b.timestamp)
  .map((day) => {
    const userDailyAverages = Object.values(day.users).map((userDay) => ({
      beforeAverage:
        userDay.beforeCount > 0
          ? userDay.beforeTotal / userDay.beforeCount
          : null,
      afterAverage:
        userDay.afterCount > 0
          ? userDay.afterTotal / userDay.afterCount
          : null
    }));

    const validBeforeUserAverages = userDailyAverages
      .map((user) => user.beforeAverage)
      .filter((value) => value !== null);
    const validAfterUserAverages = userDailyAverages
      .map((user) => user.afterAverage)
      .filter((value) => value !== null);

    return {
      date: new Date(day.timestamp).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric"
      }),
      beforeAverage:
        validBeforeUserAverages.length > 0
          ? Number(
              (
                validBeforeUserAverages.reduce((sum, value) => sum + value, 0) /
                validBeforeUserAverages.length
              ).toFixed(1)
            )
          : null,
      afterAverage:
        validAfterUserAverages.length > 0
          ? Number(
              (
                validAfterUserAverages.reduce((sum, value) => sum + value, 0) /
                validAfterUserAverages.length
              ).toFixed(1)
            )
          : null,
      userCount: userDailyAverages.length
    };
  });

const stressTrendPerUserByDate = Object.values(
  cloudSessions.reduce((acc, session) => {
    if (
      !session.created_at ||
      session.device_id == null ||
      session.stress_level === null ||
      session.stress_level === undefined
    ) {
      return acc;
    }

    const deviceId = String(session.device_id).trim();
    const stressLevelValue = Number(session.stress_level);

    if (!deviceId || !Number.isFinite(stressLevelValue)) return acc;

    const sessionDate = new Date(session.created_at);
    if (Number.isNaN(sessionDate.getTime())) return acc;

    const year = sessionDate.getFullYear();
    const month = String(sessionDate.getMonth() + 1).padStart(2, "0");
    const day = String(sessionDate.getDate()).padStart(2, "0");
    const dateKey = `${year}-${month}-${day}`;

    if (!acc[dateKey]) {
      acc[dateKey] = {
        dateKey,
        timestamp: new Date(
          year,
          sessionDate.getMonth(),
          sessionDate.getDate()
        ).getTime(),
        users: {}
      };
    }

    if (!acc[dateKey].users[deviceId]) {
      acc[dateKey].users[deviceId] = {
        stressTotal: 0,
        stressCount: 0
      };
    }

    acc[dateKey].users[deviceId].stressTotal += stressLevelValue;
    acc[dateKey].users[deviceId].stressCount += 1;

    return acc;
  }, {})
)
  .sort((a, b) => a.timestamp - b.timestamp)
  .map((day) => {
    const userDailyStressAverages = Object.values(day.users).map(
      (userDay) => userDay.stressTotal / userDay.stressCount
    );

    return {
      date: new Date(day.timestamp).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric"
      }),
      averageStressLevel: Number(
        (
          userDailyStressAverages.reduce((sum, value) => sum + value, 0) /
          userDailyStressAverages.length
        ).toFixed(1)
      ),
      participatingUsers: userDailyStressAverages.length
    };
  });

const acupressureExercises = [
  {
    id: "pc6",
    displayName: "Wrist Calm",
    pointName: "PC6 (Neiguan)",
    description: "Apply guided pressure to a point on the inner wrist using a timed visual rhythm.",
    buttonLabel: "Start Wrist Calm",
    image: pc6WristCalm,
    marker: { x: 52.15, y: 81.25 },
    instructions: "Apply comfortable pressure to the highlighted point on your inner wrist.",
    locationInstruction: "The point is located on the inner forearm between the two central tendons.",
    bilateral: true,
    requiresSideSwitch: true,
    showSideLabel: true,
    sideLabels: ["First wrist", "Opposite wrist"]
  },
  {
    id: "kd27",
    displayName: "Chest Calm",
    pointName: "KD27 (Shufu)",
    description: "Apply steady, comfortable pressure to both points beneath the collarbones using a timed visual rhythm.",
    buttonLabel: "Start Chest Calm",
    image: kd27ChestCalm,
    imageAlt: "Chest Calm pressure points beneath both collarbones",
    markers: [{ x: 36.82, y: 45.26 }, { x: 63.09, y: 45.26 }],
    instructions: "Apply steady, comfortable pressure to both highlighted points beneath your collarbones.",
    locationInstruction: "Place one fingertip on each highlighted point, just below the collarbones near the upper chest.",
    safetyInstruction: "Use comfortable pressure only. Stop if you experience pain, dizziness, shortness of breath, numbness, or unusual discomfort.",
    activeInstruction: "Apply steady, comfortable pressure to both points.",
    activeSupportingText: "Keep your shoulders relaxed and breathe naturally.",
    bilateral: true,
    requiresSideSwitch: false,
    showSideLabel: false,
    completionText: "You completed Chest Calm."
  },
  {
    id: "yintang",
    displayName: "Mind Calm",
    pointName: "Yintang",
    description: "Apply gentle, comfortable pressure between the eyebrows using a timed visual rhythm.",
    buttonLabel: "Start Mind Calm",
    image: yintangMindCalm,
    imageAlt: "Mind Calm pressure point between the eyebrows",
    markers: [{ x: 49.90, y: 33.79 }],
    instructions: "Apply gentle, comfortable pressure to the highlighted point between your eyebrows.",
    locationInstruction: "Place one fingertip on the highlighted point at the midpoint between the inner ends of your eyebrows.",
    safetyInstruction: "Use gentle pressure only. Stop if you experience pain, dizziness, visual disturbance, headache, skin irritation, or unusual discomfort.",
    activeInstruction: "Apply gentle, comfortable pressure with one fingertip.",
    activeSupportingText: "Relax your jaw, soften your shoulders, and breathe naturally.",
    bilateral: false,
    requiresSideSwitch: false,
    showSideLabel: false,
    completionText: "You completed Mind Calm."
  }
];
const activeAcupressureConfig = acupressureExercises.find(
  (exercise) => exercise.id === acupressureExercise
);

return (

 <div style={{
    textAlign: "center",
  paddingTop: "40px",
paddingBottom: "60px",
    minHeight: "100vh",
    backgroundColor: "#dfe8dd"
    
    }}>

    {isDevelopmentPreview && (
      <aside className="preview-mode-toolbar" aria-label="Development Preview">
        <div className="preview-mode-heading">
          <span>Preview Mode</span>
          {isAdmin && <small>Administrator preview — development only</small>}
        </div>
        <div className="preview-mode-options" role="group" aria-label="Preview role">
          <button
            type="button"
            className={`preview-mode-button ${previewRole === "consumer" ? "preview-mode-button--active" : ""}`}
            aria-pressed={previewRole === "consumer"}
            onClick={() => changePreviewRole("consumer")}
          >
            Consumer
          </button>
          <button
            type="button"
            className={`preview-mode-button ${previewRole === "admin" ? "preview-mode-button--active" : ""}`}
            aria-pressed={previewRole === "admin"}
            onClick={() => changePreviewRole("admin")}
          >
            Administrator
          </button>
        </div>
      </aside>
    )}

  
  

    {/* HOME */}
    {step === "home" && (
      <main className="home-screen">
        <div className="home-container">
          <header className="home-header">
            <p className="home-eyebrow">Wellness &amp; recovery</p>
            <h1 className="home-brand">RESET</h1>
            <p className="home-intro">
              Build structure, reset cravings, and reflect on your progress.
            </p>
            {currentUser && <a href="/account" className="home-account-link">Account</a>}
          </header>

          <section
            className="home-stats-grid"
            aria-label="Progress summary"
          >
            <p className="home-history-scope">History on this device</p>
            <div className="home-stat-card">
              <span className="home-stat-label">Total Sessions</span>
              <strong className="home-stat-value">
                {sessionLog.length}
              </strong>
            </div>

            <div className="home-stat-card">
              <span className="home-stat-label">
                Nightly Reviews Completed
              </span>
              <strong className="home-stat-value">
                {nightlyReviewCount}
              </strong>
            </div>

            <div className="home-stat-card">
              <span className="home-stat-label">
                Average Craving Reduction
              </span>
              <strong className="home-stat-value">
                {averageReduction}
              </strong>
            </div>

            <div className="home-stat-card">
              <span className="home-stat-label">
                Average Anxiety Reduction
              </span>
              <strong className="home-stat-value">
                {averageAnxietyReduction ?? "—"}
              </strong>
            </div>
          </section>

          <section className="home-actions-section">
            <div className="home-section-heading">
              <h2>What would you like to do?</h2>
              <p>Choose an action to continue your recovery plan.</p>
            </div>

            <div className="home-actions-grid">
              <div className="home-action-slot">
                <button
                  onClick={beginCravingReset}
                  className="home-action-button"
                >
                  <span className="home-action-title">Craving Reset</span>
                  <span className="home-action-description">
                    Pause and work through an urge
                  </span>
                </button>
              </div>

              <div className="home-action-slot">
                <button
                  type="button"
                  onClick={() => setStep("acupressure-library")}
                  className="home-action-button"
                >
                  <span className="home-action-title">Guided Acupressure</span>
                  <span className="home-action-description">Choose a guided pressure-point exercise.</span>
                  <span className="home-action-cta">Explore Acupressure</span>
                </button>
              </div>

              <div className="home-action-slot">
                <button
                  onClick={() => setStep("structure")}
                  className="home-action-button"
                >
                  <span className="home-action-title">
                    Structure Planner
                  </span>
                  <span className="home-action-description">
                    Plan the anchors for your day
                  </span>
                </button>
              </div>

              <div className="home-action-slot">
                <button
                  onClick={() => setStep("review")}
                  className="home-action-button"
                >
                  <span className="home-action-title">Nightly Review</span>
                  <span className="home-action-description">
                    Reflect on today and prepare for tomorrow
                  </span>
                </button>
              </div>

              {/*
                This action slot can later be wrapped in an administrator
                or clinician condition without changing the grid layout.
              */}
              {isAdmin && <div className="home-action-slot home-action-slot--analytics">
                <button
                  onClick={() => {
                    setStep("analytics");
                  }}
                  className="home-action-button"
                >
                  <span className="home-action-title">Analytics</span>
                  <span className="home-action-description">
                    View engagement and outcome trends
                  </span>
                </button>
              </div>}
            </div>

            <p className="home-date">
              {new Date().toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric"
              })}
            </p>
          </section>

          <section className="home-reviews-section">
            <div className="home-section-heading">
              <h2>Recent Nightly Reviews</h2>
              <p>Your five most recent reflections.</p>
            </div>

            <div className="home-reviews-list">
              {
                (
                  Array.isArray(JSON.parse(localStorage.getItem("nightlyReview")))
                    ? JSON.parse(localStorage.getItem("nightlyReview"))
                    : []
                )
                  .slice()
                  .reverse()
                  .slice(0, 5)
                  .map((review, index) => (
                    <article
                      key={index}
                      className="home-review-card"
                    >
                      <p className="home-review-date">
                        {review.date}
                      </p>

                      <div className="home-review-content">
                        <div className="home-review-field">
                          <span>Wins</span>
                          <p>{review.wins}</p>
                        </div>

                        <div className="home-review-field">
                          <span>Challenge</span>
                          <p>{review.challenge}</p>
                        </div>

                        <div className="home-review-field">
                          <span>Tomorrow</span>
                          <p>{review.tomorrowFocus}</p>
                        </div>
                      </div>
                    </article>
                  ))
              }
            </div>
          </section>
        </div>
      </main>
    )}
    
    {/* BEFORE */}
{step === "before" && (
  <main className="craving-before-screen">
    <div className="craving-before-container">
      <header className="craving-before-header">
        <h2>How strong is the craving?</h2>
        <p>
          Choose the number that best reflects your craving right now.
        </p>
      </header>

      <div className="craving-before-scale">
      {[1,2,3,4,5,6,7,8,9,10].map((n) => (
        <button
          type="button"
          key={n}
          onClick={() => setBeforeScore(n)}
          className={`craving-before-button ${
            beforeScore === n ? "craving-before-button--selected" : ""
          }`}
          aria-pressed={beforeScore === n}
        >
          {n}
        </button>
      ))}
      </div>

      <div className="craving-before-labels" aria-hidden="true">
        <span>Not at all</span>
        <span>Extremely</span>
      </div>

      <button
        type="button"
        disabled={beforeScore === null}
        onClick={() => setStep("pre-reset-anxiety")}
        className="craving-before-continue"
      >
        Continue
      </button>
    </div>
  </main>
)}

{step === "pre-reset-anxiety" && (
  <RatingScreen
    title="How anxious do you feel right now?"
    description="Choose the number that best reflects your anxiety before RESET."
    value={anxietyBefore}
    onChange={setAnxietyBefore}
    onContinue={() => setStep("reset")}
  />
)}

    {/* RESET */}
    {step === "reset" && (
      <div>
        <div
  style={{
    width: "240px",
    height: "240px",
    borderRadius: "50%",
    backgroundColor:
      phase === "Inhale"
        ? "#a8d5ba"
        : phase === "Hold"
        ? "#f2d8a7"
        : "#c9d7f0",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    margin: "40px auto",
   transform:
  phase === "Inhale"
    ? "scale(1.25)"
    : phase === "Hold"
    ? "scale(1.25)"
    : "scale(0.65)",
   transition: "all 4s linear",
boxShadow: "0 0 40px rgba(0,0,0,0.15)"
  }}
>
  <h2 style={{ margin: 0, fontSize: "32px" }}>
    {phase}
  </h2>

  <h1 style={{ margin: 0, fontSize: "64px" }}>
    {timer}
  </h1>
</div>

        <button
          onClick={() => setStep("message")}
          className="structure-submit-button breathing-continue-button"
        >
          Continue RESET
        </button>
      </div>
    )}

    {/* MESSAGE */}
    {step === "message" && (
      <main className="impulse-screen">
        <div className="impulse-container">
          <header className="impulse-header">
            <h2>Pause the impulse.</h2>
            <p>Choose what would help you most right now.</p>
          </header>

          <div className="impulse-actions">
            <button
              type="button"
              onClick={() => setStep("reset")}
              className="impulse-action-button"
            >
              <span className="impulse-action-title">Breathe Again</span>
              <span className="impulse-action-description">
                Repeat the guided breathing cycle.
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStep("channel")}
              className="impulse-action-button"
            >
              <span className="impulse-action-title">Channel Energy</span>
              <span className="impulse-action-description">
                Redirect the urge into a brief physical action.
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStep("analysis")}
              className="impulse-action-button impulse-action-button--primary"
            >
              <span className="impulse-action-title">Continue</span>
              <span className="impulse-action-description">
                Move on to your post-RESET check-in.
              </span>
            </button>
          </div>
        </div>
      </main>
    )}
{/* CHANNEL */}
{step === "channel" && (
  <main className="channel-screen">
    <div className="channel-container">
      <header className="channel-header">
        <h1>Channel the energy</h1>
        <p>Don’t sit with it. Move it.</p>
      </header>

      <div className="channel-actions">
        {[
          "10-min fast walk",
          "20 Push up or squats",
          "Cold Water Reset",
          "Clean one small area",
          "Contact support"
        ].map((item) => (
          <button
            type="button"
  key={item}
 onClick={() => {
  setSelectedChannel(item);
  setSelectedAction(item);
  setStep("analysis");
}}
            className="structure-submit-button channel-preset-button"
          >
            {item}
          </button>
        ))}
      </div>

      <div className="channel-custom-actions">
        <div className="channel-custom-action">
          <input
            type="text"
            placeholder="Custom action 1"
            value={customAction1}
            onChange={(e) => setCustomAction1(e.target.value)}
            className="structure-input channel-custom-input"
          />
          <button
            type="button"
onClick={() => {
  setSelectedChannel(customAction1);
  setSelectedAction(customAction1);
  setStep("analysis");
}}
            className="structure-submit-button channel-custom-button"
          >
            Use Custom Action 1
          </button>
        </div>

        <div className="channel-custom-action">
          <input
            type="text"
            placeholder="Custom action 2"
            value={customAction2}
            onChange={(e) => setCustomAction2(e.target.value)}
            className="structure-input channel-custom-input"
          />
          <button
            type="button"
  onClick={() => {
  setSelectedChannel(customAction2);
  setSelectedAction(customAction2);
  setStep("analysis");
}}
            className="structure-submit-button channel-custom-button"
          >
            Use Custom Action 2
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setStep("analysis")}
        className="structure-submit-button channel-continue-button"
      >
        Continue
      </button>
    </div>
  </main>
)}
    {/* ANALYSIS */}
    {step === "analysis" && (
      <main className="craving-after-screen">
        <div className="craving-after-container">
          <header className="craving-after-header">
            <h2>Before and After</h2>
            <p>How strong is the craving now?</p>
          </header>

          <div className="craving-after-scale">
            {[1,2,3,4,5,6,7,8,9,10].map((num) => (
              <button
                type="button"
                key={num}
                onClick={() => setAfterScore(num)}
                className={`craving-after-button ${
                  afterScore === num ? "craving-after-button--selected" : ""
                }`}
                aria-pressed={afterScore === num}
              >
                {num}
              </button>
            ))}
          </div>

          <div className="craving-after-labels" aria-hidden="true">
            <span>Not at all</span>
            <span>Extremely</span>
          </div>

          {getCravingChangeMessage(beforeScore, afterScore) && (
            <div
              className={`craving-after-result ${
                afterScore < beforeScore
                  ? "craving-after-result--improved"
                  : afterScore > beforeScore
                  ? "craving-after-result--increased"
                  : "craving-after-result--unchanged"
              }`}
            >
              <p>
                {getCravingChangeMessage(beforeScore, afterScore)}
              </p>
            </div>
          )}

          <button
            type="button"
            disabled={afterScore === null}
            onClick={() => {
  setAnxietyAfter(null);
  setStep("post-reset-stress");

}}
            className="craving-after-finish"
          >
            Finish
          </button>
        </div>
      </main>
    )}

    {step === "post-reset-stress" && (
      <RatingScreen
        title="How anxious do you feel right now?"
        description="Choose the number that best reflects your anxiety after RESET."
        value={anxietyAfter}
        onChange={setAnxietyAfter}
        feedback={getAnxietyChangeMessage(anxietyBefore, anxietyAfter)}
        feedbackTone={
          anxietyAfter < anxietyBefore
            ? "improved"
            : anxietyAfter > anxietyBefore
            ? "increased"
            : "unchanged"
        }
        onContinue={() => {
          saveCompletedReset();
        }}
      />
    )}

    {step === "saving" && (
      <main className="reset-complete-screen fade-in">
        <div className="reset-complete-container" role="status">
          <header className="reset-complete-header">
            <h2>Saving your RESET…</h2>
            <p>Your session is already saved on this device.</p>
          </header>
        </div>
      </main>
    )}

    {step === "elevated-fallback" && (
      <main className="impulse-screen">
        <div className="impulse-container">
          <header className="impulse-header">
            <h2>Your check-in is still elevated.</h2>
            <p>You can try a different self-regulation technique.</p>
          </header>
          <div className="impulse-actions">
            <button type="button" className="impulse-action-button impulse-action-button--primary" onClick={() => {
              setCravingBeforeAcupressure(afterScore);
              setStressBeforeAcupressure(anxietyAfter);
              setInterventionType("acupressure");
              setAcupressureExercise("pc6");
              setAcupressureCompleted(false);
              setAcupressureCompletedAt(null);
              setCravingAfterAcupressure(null);
              setStressAfterAcupressure(null);
              setAcupressureReturnStep("elevated-fallback");
              setStep("acupressure");
            }}><span className="impulse-action-title">Try Wrist Calm</span></button>
            <button type="button" className="impulse-action-button" onClick={() => setStep("reset")}><span className="impulse-action-title">Repeat Breathing</span></button>
            <button type="button" className="impulse-action-button" onClick={() => { setSelectedAction("Contact support"); setStep("done"); }}><span className="impulse-action-title">Contact Support</span></button>
            <button type="button" className="impulse-action-button" onClick={() => setStep("done")}><span className="impulse-action-title">Continue</span></button>
          </div>
        </div>
      </main>
    )}

    {step === "acupressure-library" && (
      <AcupressureSelection
        exercises={acupressureExercises}
        onBack={() => setStep("home")}
        onSelectExercise={(exerciseId) => {
          setCravingBeforeAcupressure(afterScore ?? beforeScore);
          setStressBeforeAcupressure(anxietyAfter);
          setInterventionType("acupressure");
          setAcupressureExercise(exerciseId);
          setAcupressureCompleted(false);
          setAcupressureCompletedAt(null);
          setCravingAfterAcupressure(null);
          setStressAfterAcupressure(null);
          setAcupressureReturnStep("acupressure-library");
          setStep("acupressure");
        }}
      />
    )}

    {step === "acupressure" && activeAcupressureConfig && (
      <AcupressureExercise
        {...activeAcupressureConfig}
        duration={60}
        onExit={() => setStep(acupressureReturnStep)}
        onComplete={() => {
          setAcupressureCompleted(true);
          setAcupressureCompletedAt(new Date().toISOString());
          setStep("acupressure-craving");
        }}
      />
    )}

    {step === "acupressure-craving" && (
      <RatingScreen title="Current craving" description="How strong is the craving now?" value={cravingAfterAcupressure} onChange={setCravingAfterAcupressure} onContinue={() => setStep("acupressure-stress")} />
    )}

    {step === "acupressure-stress" && (
      <RatingScreen title="Current stress or anxiety" description="How stressed or anxious do you feel now?" value={stressAfterAcupressure} onChange={setStressAfterAcupressure} onContinue={() => setStep("done")} />
    )}

    {/* STRUCTURE */}
    {step === "structure" && (
      <main className="structure-screen">
        <div className="structure-container">
          <header className="structure-header">
            <h2>Build today’s structure</h2>
            <p className="structure-date">
              {new Date().toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric"
              })}
            </p>
            <p className="structure-subtitle">
              Choose your anchors for the day—set your plan, stay on track.
            </p>
          </header>

          <section className="structure-section">
            <div className="structure-section-heading">
              <h3>Wake Time</h3>
              <p>When will your day begin?</p>
            </div>

            <div className="structure-preset-grid">
              {["6:00", "7:00", "8:00"].map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setWakeTime(t)}
                  className={`structure-preset-button ${
                    wakeTime === t ? "structure-preset-button--selected" : ""
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="Custom wake time"
              value={wakeTime}
              onChange={(e) => setWakeTime(e.target.value)}
              className="structure-input"
            />
          </section>

          <section className="structure-section">
            <div className="structure-section-heading">
              <h3>Main Block</h3>
              <p>What is your main focus for the day?</p>
            </div>

            <div className="structure-preset-grid">
              {["gym", "writing", "appointment"].map((b) => (
                <button
                  type="button"
                  key={b}
                  onClick={() => setBlock(b)}
                  className={`structure-preset-button ${
                    block === b ? "structure-preset-button--selected" : ""
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="Custom main block"
              value={block}
              onChange={(e) => setBlock(e.target.value)}
              className="structure-input"
            />
          </section>

          <section className="structure-section">
            <div className="structure-section-heading">
              <h3>Connection</h3>
              <p>How will you connect with someone today?</p>
            </div>

            <div className="structure-preset-grid structure-preset-grid--connection">
              {["Sponsor", "Meeting", "Family", "Friend"].map((option) => (
                <button
                  type="button"
                  key={option}
                  onClick={() => setConnection(option)}
                  className={`structure-preset-button ${
                    connection === option
                      ? "structure-preset-button--selected"
                      : ""
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="Who are you connecting with?"
              value={connection}
              onChange={(e) => setConnection(e.target.value)}
              className="structure-input"
            />
          </section>

          <button
            onClick={() => {
              saveStructurePlan();
              setStep("mood");
            }}
            className="structure-submit-button"
          >
            Lock It In
          </button>
        </div>
      </main>
    )}
{/* REVIEW */}
{step === "review" && (
  <main className="nightly-review-screen">
    <div className="nightly-review-container">
      <header className="nightly-review-header">
        <h2>Nightly Review</h2>
        <p>Reflect on today before closing the day.</p>
      </header>

      <div className="nightly-review-form">
        <div className="nightly-review-question">
          <label htmlFor="nightly-review-wins">What went well today?</label>
          <textarea
            id="nightly-review-wins"
            value={wins}
            onChange={(e) => setWins(e.target.value)}
            rows={3}
            className="nightly-review-textarea"
          />
        </div>

        <div className="nightly-review-question">
          <label htmlFor="nightly-review-challenge">
            What challenge did you overcome?
          </label>
          <textarea
            id="nightly-review-challenge"
            value={challenge}
            onChange={(e) => setChallenge(e.target.value)}
            rows={3}
            className="nightly-review-textarea"
          />
        </div>

        <div className="nightly-review-question">
          <label htmlFor="nightly-review-focus">What is tomorrow’s focus?</label>
          <textarea
            id="nightly-review-focus"
            value={tomorrowFocus}
            onChange={(e) => setTomorrowFocus(e.target.value)}
            rows={3}
            className="nightly-review-textarea"
          />
        </div>
      </div>

      <button
        type="button"
      onClick={() => {
       const existingReviewsRaw =
  JSON.parse(localStorage.getItem("nightlyReview"));

const existingReviews = Array.isArray(existingReviewsRaw)
  ? existingReviewsRaw
  : existingReviewsRaw
    ? [existingReviewsRaw]
    : [];
const newReview = {
  date: new Date().toLocaleString(),
  wins,
  challenge,
  tomorrowFocus
};

const updatedReviews = [...existingReviews, newReview];
console.log("Saving nightly review");
localStorage.setItem(
  "nightlyReview",
  JSON.stringify(updatedReviews)
);
setNightlyReviewCount(updatedReviews.length);
setReviewSaved(true);
setTimeout(() => {
  setReviewSaved(false);
  setStep("home");
}, 1800);
      }}
        className="structure-submit-button nightly-review-save-button"
    >
      Save Reflection
    </button>

      {reviewSaved && (
        <div className="nightly-review-success" role="status">
          Reflection saved. Great job showing up today.
        </div>
      )}
    </div>
  </main>
)}
{/* MOOD */}
{step === "mood" && (
  <main className="mood-screen fade-in">
    <div className="mood-container">
      <header className="mood-header">
        <h2>How is your mood right now?</h2>
        <p>
          Choose the option that best reflects how you feel right now.
        </p>
      </header>

      <div className="mood-options-grid">
        {["Low", "Neutral", "Good"].map((m) => (
          <button
            type="button"
            key={m}
            onClick={() => setMood(m)}
            className={`mood-option-button ${
              mood === m ? "mood-option-button--selected" : ""
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={mood === ""}
        onClick={async () => {
  setMood(mood);
  setStep("home");
}}
        className="mood-save-button"
      >
        Save Check-In
      </button>
    </div>
  </main>
)}
{step === "analytics" && isAdmin && (
  <div className="card fade-in analytics-dashboard">
    <header className="analytics-header">
      <p className="analytics-eyebrow">Analytics overview</p>
      <h2>Program Dashboard</h2>
    </header>

    <section className="analytics-section">
      <div className="analytics-section-header">
        <h2>Clinical Outcomes</h2>
        <p>Program effectiveness and retention</p>
      </div>

      <div className="analytics-grid">
        <div className="analytics-metric-card analytics-kpi-accent--success">
          <h3>Users Showing Craving Improvement</h3>
          <p
            className={`analytics-metric-value ${
              cloudUsersShowingCravingImprovement === null
                ? "analytics-metric-value--text"
                : ""
            }`}
          >
            {cloudUsersShowingCravingImprovement === null
              ? "No data"
              : `${cloudUsersShowingCravingImprovement}%`}
          </p>
        </div>

        <div className="analytics-metric-card analytics-kpi-accent--change">
          <h3>Average User Craving Change</h3>
          <p
            className={`analytics-metric-value ${
              cloudAverageUserCravingChange === null
                ? "analytics-metric-value--text"
                : ""
            }`}
          >
            {cloudAverageUserCravingChange === null
              ? "No data"
              : cloudAverageUserCravingChange}
          </p>
        </div>

        <div className="analytics-metric-card analytics-kpi-accent--stress">
          <h3>Average Stress Level</h3>
          <p
            className={`analytics-metric-value ${
              averageStressLevel === null
                ? "analytics-metric-value--text"
                : ""
            }`}
          >
            {averageStressLevel === null
              ? "No data"
              : `${averageStressLevel}/10`}
          </p>
        </div>

        <div className="analytics-metric-card">
          <h3>Returning Users</h3>
          <p className="analytics-metric-value">{cloudReturningUsers}</p>
        </div>
      </div>

      <p className="analytics-outcome-note">
        Outcome KPIs give each participating user equal weight, regardless of
        session frequency.
      </p>
    </section>

    <section className="analytics-section support-signals-section">
      <div className="analytics-section-header">
        <h2>Recovery Support Signals</h2>
        <span className="support-signals-badge">Aggregate only</span>
        <p>
          Anonymous program-wide indicators showing how many participating
          users reported elevated recovery support needs today.
        </p>
      </div>

      <div className="support-signals-summary">
        <span className="analytics-trend-info-icon" aria-hidden="true">i</span>
        <p>
          {elevatedCravingUserCount +
            elevatedStressUserCount +
            combinedSupportSignalUserCount ===
          0
            ? "No elevated recovery support signals reported today."
            : `${
                elevatedCravingUserCount +
                elevatedStressUserCount +
                combinedSupportSignalUserCount
              } recovery support signals were recorded today.`}
        </p>
      </div>

      <div className="analytics-grid support-signals-grid">
        <div className="analytics-metric-card support-signal-card support-signal-card--craving">
          <div className="support-signal-card-header">
            <h3>Elevated Cravings</h3>
          </div>
          <p className="analytics-metric-value support-signal-count support-signal-count--craving">
            {elevatedCravingUserCount}
          </p>
          <p className="support-signal-description">
            Users reporting cravings of 8–10 today
          </p>
          <span className="support-signal-today">Today</span>
        </div>

        <div className="analytics-metric-card support-signal-card support-signal-card--stress">
          <div className="support-signal-card-header">
            <h3>Elevated Stress &amp; Anxiety</h3>
          </div>
          <p className="analytics-metric-value support-signal-count support-signal-count--stress">
            {elevatedStressUserCount}
          </p>
          <p className="support-signal-description">
            Users reporting stress or anxiety of 8–10 today
          </p>
          <span className="support-signal-today">Today</span>
        </div>

        <div className="analytics-metric-card support-signal-card support-signal-card--combined">
          <div className="support-signal-card-header">
            <h3>Combined Support Signal</h3>
          </div>
          <p className="analytics-metric-value support-signal-count support-signal-count--combined">
            {combinedSupportSignalUserCount}
          </p>
          <p className="support-signal-description">
            Users reporting Low mood with cravings of 7–10 today
          </p>
          <span className="support-signal-today">Today</span>
        </div>
      </div>

      <p className="support-signals-note">
        These anonymous indicators summarize user-reported check-ins submitted
        today. They are intended to help organizations understand overall
        recovery support needs and do not represent diagnoses, clinical risk
        assessments, or confirmation that staff are monitoring individual
        users.
      </p>
    </section>

    <section className="analytics-section support-signals-section">
      <div className="analytics-section-header">
        <h2>Engagement Signals</h2>
        <span className="support-signals-badge">Aggregate only</span>
        <p>
          Anonymous indicators showing participant engagement with the RESET
          program.
        </p>
      </div>

      <div className="analytics-grid">
        <div className="analytics-metric-card">
          <h3>RESET Sessions Completed</h3>
          <p className="analytics-metric-value">{cloudTotalSessions}</p>
        </div>

        <div className="analytics-metric-card">
          <h3>Sessions per User</h3>
          <p className="analytics-metric-value">{cloudSessionsPerUser}</p>
        </div>

        <div className="analytics-metric-card">
          <h3>Unique Users</h3>
          <p className="analytics-metric-value">{cloudUniqueUsers}</p>
        </div>

        <div className="analytics-metric-card">
          <h3>Returning Rate</h3>
          <p className="analytics-metric-value">
            {cloudReturningUserRate}%
          </p>
        </div>
      </div>

      <div className="support-signals-summary engagement-signals-summary">
        <span className="analytics-trend-info-icon" aria-hidden="true">i</span>
        <p>
          {engagementReengagementUserCount === 0
            ? "All active participants have checked in recently."
            : `${engagementReengagementUserCount} anonymous participants may benefit from encouragement to re-engage.`}
        </p>
      </div>

      <div className="analytics-grid support-engagement-grid">
        <div className="analytics-metric-card support-signal-card support-engagement-card support-engagement-card--today">
          <div className="support-signal-card-header">
            <h3>No Check-in Today</h3>
          </div>
          <p className="analytics-metric-value support-signal-count support-engagement-count--today">
            {noCheckInTodayUserCount}
          </p>
          <p className="support-signal-description">
            Participating users who have not submitted a RESET session today.
          </p>
          <span className="support-signal-today">Today</span>
        </div>

        <div className="analytics-metric-card support-signal-card support-engagement-card support-engagement-card--seven-days">
          <div className="support-signal-card-header">
            <h3>No Check-in for 7 Days</h3>
          </div>
          <p className="analytics-metric-value support-signal-count support-engagement-count--seven-days">
            {noCheckInSevenDaysUserCount}
          </p>
          <p className="support-signal-description">
            Participating users whose most recent RESET session was more than
            7 days ago.
          </p>
          <span className="support-signal-today">7 Days</span>
        </div>
      </div>

      <p className="support-engagement-note">
        Engagement indicators are calculated anonymously from each
        participant's most recent RESET activity. They do not imply relapse,
        clinical deterioration, or confirmation that staff are monitoring
        individual users.
      </p>
    </section>

    <section className="analytics-section support-signals-section recovery-patterns-section">
      <div className="analytics-section-header">
        <h2>Recovery Patterns</h2>
        <span className="support-signals-badge">Aggregate only</span>
        <p>
          Anonymous patterns that help organizations understand participant
          recovery and engagement trends.
        </p>
      </div>

      <div className="support-signals-summary recovery-patterns-summary">
        <span className="analytics-trend-info-icon" aria-hidden="true">i</span>
        <p>
          {recoveryPatternTotal === 0
            ? "No significant recovery patterns detected."
            : "Anonymous recovery patterns have been identified across the program. These trends may help organizations understand participant engagement and recovery over time."}
        </p>
      </div>

      <div className="analytics-grid recovery-patterns-grid">
        <div className="analytics-metric-card support-signal-card recovery-pattern-card recovery-pattern-card--craving">
          <div className="support-signal-card-header">
            <h3>Repeated High Cravings</h3>
          </div>
          <p className="analytics-metric-value support-signal-count recovery-pattern-count--craving">
            {repeatedHighCravingUserCount}
          </p>
          <p className="support-signal-description">
            Participants reporting cravings of 8–10 on multiple check-ins
            during the past week.
          </p>
        </div>

        <div className="analytics-metric-card support-signal-card recovery-pattern-card recovery-pattern-card--stress">
          <div className="support-signal-card-header">
            <h3>Repeated High Stress &amp; Anxiety</h3>
          </div>
          <p className="analytics-metric-value support-signal-count recovery-pattern-count--stress">
            {repeatedHighStressUserCount}
          </p>
          <p className="support-signal-description">
            Participants reporting stress or anxiety of 8–10 on multiple
            check-ins during the past week.
          </p>
        </div>

        <div className="analytics-metric-card support-signal-card recovery-pattern-card recovery-pattern-card--inactive">
          <div className="support-signal-card-header">
            <h3>Inactive 7+ Days</h3>
          </div>
          <p className="analytics-metric-value support-signal-count recovery-pattern-count--inactive">
            {noCheckInSevenDaysUserCount}
          </p>
          <p className="support-signal-description">
            Participants whose most recent RESET session was more than seven
            days ago.
          </p>
        </div>

        <div className="analytics-metric-card support-signal-card recovery-pattern-card recovery-pattern-card--improving">
          <div className="support-signal-card-header">
            <h3>Improving Participants</h3>
          </div>
          <p className="analytics-metric-value support-signal-count recovery-pattern-count--improving">
            {improvingParticipantCount}
          </p>
          <p className="support-signal-description">
            Participants whose average craving has improved compared with the
            previous week.
          </p>
        </div>
      </div>

      <p className="support-signals-note recovery-patterns-note">
        Recovery Patterns summarize anonymous program-wide trends and are
        intended to support program evaluation and service planning. They do
        not diagnose relapse, predict individual outcomes, or identify specific
        participants.
      </p>
    </section>

    <section className="analytics-section analytics-trend-section">
      <div className="analytics-section-header">
        <h2>Craving Trend</h2>
        <span className="analytics-trend-badge">Program-wide aggregate</span>
        <p>
          Daily average craving intensity per participating user, before and
          after RESET.
        </p>
      </div>

      {cravingTrendPerUserByDate.length >= 2 ? (
        <div
          className="analytics-trend-chart"
          role="img"
          aria-label="Line chart comparing average craving intensity before and after RESET by day"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={cravingTrendPerUserByDate}
              margin={{ top: 12, right: 16, left: 28, bottom: 8 }}
              accessibilityLayer
            >
              <CartesianGrid stroke="#c5cec6" strokeDasharray="4 4" />
              <XAxis
                dataKey="date"
                tick={{ fill: "#555", fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: "#ccc" }}
              />
              <YAxis
                domain={[0, 10]}
                ticks={[0, 2, 4, 6, 8, 10]}
                allowDataOverflow
                tick={{ fill: "#555", fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                label={{
                  value: "Average Craving Intensity (0–10)",
                  angle: -90,
                  position: "insideLeft",
                  offset: -12,
                  fill: "#555",
                  fontSize: 12
                }}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;

                  const beforeValue = payload.find(
                    (item) => item.dataKey === "beforeAverage"
                  )?.value;
                  const afterValue = payload.find(
                    (item) => item.dataKey === "afterAverage"
                  )?.value;

                  return (
                    <div className="analytics-trend-tooltip">
                      <strong>Date: {label}</strong>
                      <span>
                        Before RESET: {beforeValue == null
                          ? "No data"
                          : Number(beforeValue).toFixed(1)}
                      </span>
                      <span>
                        After RESET: {afterValue == null
                          ? "No data"
                          : Number(afterValue).toFixed(1)}
                      </span>
                    </div>
                  );
                }}
              />
              <Legend
                formatter={(value) =>
                  value === "Before RESET"
                    ? "🟡 Before RESET"
                    : "🟢 After RESET"
                }
                wrapperStyle={{ paddingTop: "14px" }}
              />
              <Line
                type="monotone"
                dataKey="beforeAverage"
                name="Before RESET"
                stroke="#F4B400"
                strokeWidth={3}
                dot={{ r: 5, fill: "#F4B400", stroke: "#F4B400" }}
                activeDot={{ r: 7, fill: "#F4B400", stroke: "white" }}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="afterAverage"
                name="After RESET"
                stroke="#16A34A"
                strokeWidth={3}
                dot={{ r: 5, fill: "#16A34A", stroke: "#16A34A" }}
                activeDot={{ r: 7, fill: "#16A34A", stroke: "white" }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="analytics-trend-empty">
          More session data is needed to display this trend.
        </div>
      )}

      <div className="analytics-trend-info">
        <span className="analytics-trend-info-icon" aria-hidden="true">i</span>
        <p>
          Each user contributes one daily average, regardless of how many
          RESET sessions they completed that day. Lower scores indicate lower
          craving intensity.
        </p>
      </div>
    </section>

    <section className="analytics-section analytics-trend-section analytics-stress-trend-section">
      <div className="analytics-section-header">
        <h2>Stress &amp; Anxiety Trend</h2>
        <span className="analytics-trend-badge">Program-wide aggregate</span>
        <p>Daily average stress or anxiety level per participating user.</p>
      </div>

      {stressTrendPerUserByDate.length >= 2 ? (
        <div
          className="analytics-trend-chart"
          role="img"
          aria-label="Line chart showing average stress or anxiety level per participating user by day"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={stressTrendPerUserByDate}
              margin={{ top: 12, right: 16, left: 28, bottom: 8 }}
              accessibilityLayer
            >
              <CartesianGrid stroke="#c5cec6" strokeDasharray="4 4" />
              <XAxis
                dataKey="date"
                tick={{ fill: "#555", fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: "#ccc" }}
              />
              <YAxis
                domain={[0, 10]}
                ticks={[0, 2, 4, 6, 8, 10]}
                allowDataOverflow
                tick={{ fill: "#555", fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                label={{
                  value: "Average Stress Level (0–10)",
                  angle: -90,
                  position: "insideLeft",
                  offset: -12,
                  fill: "#555",
                  fontSize: 12
                }}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;

                  const chartPoint = payload[0]?.payload;

                  return (
                    <div className="analytics-trend-tooltip">
                      <strong>Date: {label}</strong>
                      <span>
                        Average Stress &amp; Anxiety: {Number(
                          chartPoint.averageStressLevel
                        ).toFixed(1)}
                      </span>
                      <span>
                        Participating Users: {chartPoint.participatingUsers}
                      </span>
                    </div>
                  );
                }}
              />
              <Legend wrapperStyle={{ paddingTop: "14px" }} />
              <Line
                type="monotone"
                dataKey="averageStressLevel"
                name="Average Stress & Anxiety"
                stroke="#F59E0B"
                strokeWidth={3}
                dot={{ r: 5, fill: "#F59E0B", stroke: "#F59E0B" }}
                activeDot={{ r: 7, fill: "#F59E0B", stroke: "white" }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="analytics-trend-empty">
          More stress check-in data is needed to display this trend.
        </div>
      )}

      <div className="analytics-trend-info">
        <span className="analytics-trend-info-icon" aria-hidden="true">i</span>
        <p>
          Each participating user contributes one daily average, regardless of
          how many sessions they completed that day. Lower scores indicate
          lower reported stress or anxiety.
        </p>
      </div>
    </section>

    <section className="analytics-section">
      <div className="analytics-section-header">
        <h2>Mood Analytics</h2>
        <p>Session volume and average reduction by mood</p>
      </div>

      <div className="analytics-grid analytics-mood-grid">
        <div className="analytics-metric-card analytics-mood-card">
          <h3>Low Mood</h3>

          <div className="analytics-mood-metrics">
            <div>
              <span>Sessions</span>
              <strong>{cloudLowMoodCount}</strong>
            </div>

            <div>
              <span>Avg Reduction</span>
              <strong>{cloudLowMoodReduction}</strong>
            </div>
          </div>
        </div>

        <div className="analytics-metric-card analytics-mood-card">
          <h3>Neutral Mood</h3>

          <div className="analytics-mood-metrics">
            <div>
              <span>Sessions</span>
              <strong>{cloudNeutralMoodCount}</strong>
            </div>

            <div>
              <span>Avg Reduction</span>
              <strong>{cloudNeutralMoodReduction}</strong>
            </div>
          </div>
        </div>

        <div className="analytics-metric-card analytics-mood-card">
          <h3>Good Mood</h3>

          <div className="analytics-mood-metrics">
            <div>
              <span>Sessions</span>
              <strong>{cloudGoodMoodCount}</strong>
            </div>

            <div>
              <span>Avg Reduction</span>
              <strong>{cloudGoodMoodReduction}</strong>
            </div>
          </div>
        </div>

        <div className="analytics-metric-card analytics-kpi-accent--mood">
          <h3>Most Reported Mood</h3>
          <p className="analytics-metric-value analytics-metric-value--text">
            {mostReportedMood}
          </p>
        </div>
      </div>
    </section>

    <div className="analytics-footer">
      <button
        onClick={() => setStep("home")}
        className="structure-submit-button analytics-home-button"
      >
        Return Home
      </button>
    </div>
  </div>
  )}
    {/* DONE */}
    {step === "done" && (
      <main className="reset-complete-screen fade-in">
        <div className="reset-complete-container">
          <header className="reset-complete-header">
            <h2>RESET Complete</h2>
            {saveStatus === "failed" ? (
              <div role="alert">
                <p>Your RESET was saved on this device, but cloud sync failed.</p>
                <button
                  type="button"
                  className="reset-complete-home-button"
                  onClick={retryCloudSave}
                >
                  Retry
                </button>
              </div>
            ) : (
              <p>Your RESET has been recorded.</p>
            )}
          </header>

          <div className="reset-complete-summary">
            <section className="reset-complete-section">
              <h3>Today’s Structure Plan</h3>

              <div className="reset-complete-row">
                <span className="reset-complete-label">Wake Time</span>
                <strong className="reset-complete-value">{todayStructurePlan?.wakeTime || "Not set"}</strong>
              </div>

              <div className="reset-complete-row">
                <span className="reset-complete-label">Focus Block</span>
                <strong className="reset-complete-value">{todayStructurePlan?.block || "Not set"}</strong>
              </div>

              <div className="reset-complete-row">
                <span className="reset-complete-label">Connection</span>
                <strong className="reset-complete-value">{todayStructurePlan?.connection || "Not set"}</strong>
              </div>

              {!todayStructurePlan && saveStatus === "synced" && (
                <div className="reset-complete-structure-prompt">
                  <p>Your RESET has been recorded. Strengthen the rest of your day by creating a simple Structure Plan.</p>
                  <button
                    type="button"
                    className="structure-submit-button reset-complete-structure-button"
                    onClick={() => setStep("structure")}
                  >
                    Complete Your Structure Plan
                  </button>
                </div>
              )}
            </section>

            <section className="reset-complete-section">
              <h3>Craving Result</h3>
              <div
                className={`reset-complete-result ${
                  afterScore < beforeScore
                    ? "reset-complete-result--improved"
                    : afterScore > beforeScore
                    ? "reset-complete-result--increased"
                    : "reset-complete-result--unchanged"
                }`}
              >
                <p>
                  {getCravingChangeMessage(beforeScore, afterScore)}
                </p>
              </div>
            </section>

            {anxietyBefore !== null && anxietyAfter !== null && (
              <section className="reset-complete-section">
                <h3>Anxiety Result</h3>
                <div className="reset-complete-row">
                  <span className="reset-complete-label">Anxiety before</span>
                  <strong className="reset-complete-value">{anxietyBefore}/10</strong>
                </div>
                <div className="reset-complete-row">
                  <span className="reset-complete-label">Anxiety after</span>
                  <strong className="reset-complete-value">{anxietyAfter}/10</strong>
                </div>
                <div className="reset-complete-row">
                  <span className="reset-complete-label">Anxiety reduction</span>
                  <strong className="reset-complete-value">
                    {anxietyAfter > anxietyBefore
                      ? `Not applicable — increased by ${anxietyAfter - anxietyBefore} points`
                      : `${anxietyBefore - anxietyAfter} points`}
                  </strong>
                </div>
                <div className={`reset-complete-result ${
                  anxietyAfter < anxietyBefore
                    ? "reset-complete-result--improved"
                    : anxietyAfter > anxietyBefore
                    ? "reset-complete-result--increased"
                    : "reset-complete-result--unchanged"
                }`}>
                  <p>
                    {getAnxietyChangeMessage(anxietyBefore, anxietyAfter)}
                  </p>
                </div>
              </section>
            )}

            <section className="reset-complete-section">
              <h3>Channel Action</h3>
              <p className="reset-complete-channel-value">
                {selectedAction || "No channel action selected."}
              </p>
            </section>

            {acupressureCompleted && (
              <section className="reset-complete-section">
                <h3>Wrist Calm Result</h3>
                <div className="reset-complete-row">
                  <span className="reset-complete-label">Technique</span>
                  <strong className="reset-complete-value">{interventionType}</strong>
                </div>
                <div className="reset-complete-row">
                  <span className="reset-complete-label">Exercise</span>
                  <strong className="reset-complete-value">{acupressureExercise}</strong>
                </div>
                <div className="reset-complete-row">
                  <span className="reset-complete-label">Craving</span>
                  <strong className="reset-complete-value">{cravingBeforeAcupressure}/10 to {cravingAfterAcupressure}/10</strong>
                </div>
                <div className="reset-complete-row">
                  <span className="reset-complete-label">Stress / anxiety</span>
                  <strong className="reset-complete-value">{stressBeforeAcupressure}/10 to {stressAfterAcupressure}/10</strong>
                </div>
                <div className="reset-complete-row">
                  <span className="reset-complete-label">Completed</span>
                  <strong className="reset-complete-value">{acupressureCompletedAt ? new Date(acupressureCompletedAt).toLocaleString() : "Completed"}</strong>
                </div>
              </section>
            )}
          </div>

          <button
            type="button"
            onClick={() => setStep("home")}
            className="reset-complete-home-button"
          >
            Return Home
          </button>
        </div>
      </main>
    )}

</div>
);
}
function RatingScreen({ title, description, value, onChange, onContinue, feedback, feedbackTone = "unchanged" }) {
  return (
    <main className="craving-after-screen">
      <div className="craving-after-container">
        <header className="craving-after-header"><h2>{title}</h2><p>{description}</p></header>
        <div className="mood-stress-scale">
          {[0,1,2,3,4,5,6,7,8,9,10].map((number) => (
            <button type="button" key={number} onClick={() => onChange(number)} className={`mood-stress-button ${value === number ? "mood-stress-button--selected" : ""}`} aria-pressed={value === number}>{number}</button>
          ))}
        </div>
        <div className="mood-stress-labels" aria-hidden="true"><span>Not at all</span><span>Extremely</span></div>
        {feedback && (
          <div className={`craving-after-result craving-after-result--${feedbackTone}`} role="status">
            <p>{feedback}</p>
          </div>
        )}
        <button type="button" disabled={value === null} onClick={onContinue} className="mood-save-button">Continue</button>
      </div>
    </main>
  );
}
export default App;
