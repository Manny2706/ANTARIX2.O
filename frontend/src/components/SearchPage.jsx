// import React, { useState, useRef, useEffect } from 'react';
// import { socket } from '../socket/socket';
// import { DEFAULT_USER_ID, SOCKET_KEY } from '../config/api';
// import Dashboard from './Dashboard';
// import './SearchPage.css';

// function KV({ label, value }) {
//   return (
//     <div className="kv-item">
//       <span className="kv-label">{label}</span>
//       <span className="kv-value">{value}</span>
//     </div>
//   );
// }

// export default function SearchPage({
//   onNavigate,
//   isLoggedIn = false,
//   user = null,
//   onLogin,
//   onSignup,
//   onLogout
// }) {
//   const [isSidebarOpen, setIsSidebarOpen] = useState(false);
//   const [isDashboardPanelOpen, setIsDashboardPanelOpen] = useState(false);
//   const [isPopupOpen, setIsPopupOpen] = useState(false);
//   const [showAuthModal, setShowAuthModal] = useState(false);
//   const [authModalFeature, setAuthModalFeature] = useState('');
//   const [uploadedFiles, setUploadedFiles] = useState([]);
//   const [uploadError, setUploadError] = useState('');
//   const [hasQueried, setHasQueried] = useState(false);
//   const [queryText, setQueryText] = useState("");
//   const [rawBackendResponse, setRawBackendResponse] = useState(null);
//   const [conversationId, setConversationId] = useState(null);
//   const [userId] = useState(user?.id || DEFAULT_USER_ID);
//   const [messages, setMessages] = useState([]);
//   const [isLoading, setIsLoading] = useState(false);
//   const [activeResultTab, setActiveResultTab] = useState('overview');
//   const [showEvidence, setShowEvidence] = useState(true);
//   const [analysisComplete, setAnalysisComplete] = useState(false);
//   const [timelineStep, setTimelineStep] = useState(0);
//   const [latestAiAnswer, setLatestAiAnswer] = useState("");
//   const [evidenceList, setEvidenceList] = useState([]);
//   const [openTraceSteps, setOpenTraceSteps] = useState({});
//   const [executionTrace, setExecutionTrace] = useState([]);
//   const [durationSeconds, setDurationSeconds] = useState(null);
//   const [backendResult, setBackendResult] = useState(null);
//   const [showRawJson, setShowRawJson] = useState(false);
//   const [overviewImageMode, setOverviewImageMode] = useState('change');
//   const [inputValue, setInputValue] = useState('');
//   const [sentFiles, setSentFiles] = useState([]);
//   const fileInputRef = useRef(null);

//   const handleNewAnalysis = () => {
//     setHasQueried(false);
//     setMessages([]);
//     setQueryText('');
//     setInputValue('');
//     setUploadedFiles([]);
//     setSentFiles([]);
//     setConversationId(null);
//     setAnalysisComplete(false);
//     setIsLoading(false);
//     setBackendResult(null);
//     setEvidenceList([]);
//     setExecutionTrace([]);
//     setLatestAiAnswer('');
//     setUploadError('');
//     setIsSidebarOpen(false);
//     setIsDashboardPanelOpen(false);
//   };

//   const handleProtectedNavigate = (target) => {
//     if (!isLoggedIn) {
//       setAuthModalFeature(target);
//       setShowAuthModal(true);
//       return;
//     }
//     if (onNavigate) onNavigate(target);
//   };

//   const isStepOpen = (i) => openTraceSteps[i] !== false;

//   const toggleTraceStep = (step) => {
//     setOpenTraceSteps(prev => ({ ...prev, [step]: prev[step] === false ? true : false }));
//   };

//   const toggleAllTraceSteps = (count) => {
//     const anyOpen = Array.from({ length: count }).some((_, i) => isStepOpen(i));
//     const next = {};
//     for (let i = 0; i < count; i++) next[i] = !anyOpen;
//     setOpenTraceSteps(next);
//   };

//   const renderStructuredText = (text) => {
//     if (!text || typeof text !== 'string') return text;
//     if (text.startsWith('⚠️')) {
//       return <span>{text}</span>;
//     }

//     const segments = text
//       .split(/(?:\.\s+(?=\*\*)|(?<=\))\s+(?=\*\*)|(?:\n+)|(?:-\s+))/g)
//       .map(s => s.trim())
//       .filter(Boolean);

//     if (segments.length <= 1) {
//       return (
//         <span dangerouslySetInnerHTML={{
//           __html: text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
//         }} />
//       );
//     }

//     return (
//       <div className="structured-ai-response">
//         {segments.map((seg, i) => {
//           const isHighlight = seg.toLowerCase().includes('absence') || seg.toLowerCase().includes('note') || seg.toLowerCase().includes('does not guarantee');
//           const html = seg.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
//           if (isHighlight) {
//             return (
//               <div key={i} className="response-highlight-box" dangerouslySetInnerHTML={{ __html: html }} />
//             );
//           }
//           return (
//             <div key={i} className="response-segment">
//               <span style={{ color: '#00B4D8', fontSize: '14px', lineHeight: '1.2' }}>•</span>
//               <span dangerouslySetInnerHTML={{ __html: html }} />
//             </div>
//           );
//         })}
//       </div>
//     );
//   };

//   const toTitle = (s) => (s === null || s === undefined ? '' : String(s))
//     .replace(/[_-]+/g, ' ')
//     .replace(/\b\w/g, (c) => c.toUpperCase());

//   const asPercent = (n) => {
//     if (n === null || n === undefined || n === '') return '—';
//     const num = typeof n === 'string' ? parseFloat(n) : n;
//     if (Number.isNaN(num)) return String(n);
//     return `${Math.round(num <= 1 ? num * 100 : num)}%`;
//   };

//   const formatValue = (v) => {
//     if (v === null || v === undefined) return '—';
//     if (typeof v === 'boolean') return v ? 'Yes' : 'No';
//     if (Array.isArray(v)) return v.length ? v.map(formatValue).join(', ') : '—';
//     if (typeof v === 'object') return JSON.stringify(v);
//     return String(v);
//   };

//   const handleExportJson = () => {
//     const metadata = backendResult || {};

//     const detailedJson = {
//       report_version: "1.0",

//       generated_at: new Date().toISOString(),

//       conversation: {
//         conversation_id:
//           rawBackendResponse?.conversationId ||
//           conversationId ||
//           null,

//         user_id: userId,

//         query:
//           rawBackendResponse?.userMessage?.content ||
//           metadata.query ||
//           queryText ||
//           null
//       },

//       analysis: {
//         current_task: metadata.current_task || null,
//         temporal_mode: metadata.temporal_mode || null,
//         image_count: metadata.image_count ?? null,
//         modalities: metadata.modalities || [],
//         input_valid: metadata.input_valid ?? null,
//         validation_errors: metadata.validation_errors || [],
//         confidence: metadata.confidence ?? null,
//         duration_seconds: metadata.duration_seconds ?? null,
//         retry_count: metadata.retry_count ?? 0
//       },

//       answer: {
//         final_answer:
//           rawBackendResponse?.assistantMessage?.content ||
//           metadata.final_answer ||
//           latestAiAnswer ||
//           null,

//         role:
//           rawBackendResponse?.assistantMessage?.role ||
//           "ASSISTANT",

//         decision:
//           metadata.reflection?.decision ||
//           null
//       },

//       evidence: Array.isArray(metadata.evidence)
//         ? metadata.evidence
//         : [],

//       execution_trace: Array.isArray(metadata.execution_trace)
//         ? metadata.execution_trace.map((step, index) => ({
//           step: index + 1,
//           ...step
//         }))
//         : [],

//       reflection: metadata.reflection || null,

//       artifacts: Array.isArray(metadata.artifacts)
//         ? metadata.artifacts
//         : [],

//       source: {
//         assistant_message:
//           rawBackendResponse?.assistantMessage || null,

//         user_message:
//           rawBackendResponse?.userMessage || null
//       }
//     };

//     const blob = new Blob(
//       [JSON.stringify(detailedJson, null, 2)],
//       { type: "application/json" }
//     );

//     const url = URL.createObjectURL(blob);

//     const a = document.createElement("a");
//     a.href = url;
//     a.download = `satquery_detailed_analysis_${Date.now()}.json`;

//     document.body.appendChild(a);
//     a.click();
//     document.body.removeChild(a);

//     URL.revokeObjectURL(url);
//   };

//   const handleDownloadReport = () => {
//     const r = backendResult || {};

//     const answer = r.final_answer || latestAiAnswer || "-";

//     const confidence =
//       r.confidence != null
//         ? `${Math.round(
//           r.confidence <= 1 ? r.confidence * 100 : r.confidence
//         )}%`
//         : "N/A";

//     const reflectionConfidence =
//       r.reflection?.confidence != null
//         ? `${Math.round(
//           r.reflection.confidence <= 1
//             ? r.reflection.confidence * 100
//             : r.reflection.confidence
//         )}%`
//         : "N/A";

//     const evidenceConfidence =
//       r.reflection?.evidence_confidence != null
//         ? `${Math.round(
//           r.reflection.evidence_confidence <= 1
//             ? r.reflection.evidence_confidence * 100
//             : r.reflection.evidence_confidence
//         )}%`
//         : "N/A";

//     const minConfidence =
//       r.reflection?.min_confidence != null
//         ? `${Math.round(
//           r.reflection.min_confidence <= 1
//             ? r.reflection.min_confidence * 100
//             : r.reflection.min_confidence
//         )}%`
//         : "N/A";

//     // --------------------------------------------------
//     // EVIDENCE
//     // --------------------------------------------------

//     const evidenceReport = Array.isArray(r.evidence)
//       ? r.evidence.map((e, index) => {
//         const stats = e.change_stats || {};

//         const changedFraction =
//           stats.changed_fraction != null
//             ? `${(stats.changed_fraction * 100).toFixed(2)}%`
//             : "N/A";

//         const bbox = Array.isArray(stats.change_bbox)
//           ? stats.change_bbox
//             .map(v => Number(v).toFixed(4))
//             .join(", ")
//           : "N/A";

//         const visualEvidence =
//           Array.isArray(e.visual_evidence)
//             ? e.visual_evidence.join(", ")
//             : "None";

//         return `
// ------------------------------------------------------------
// EVIDENCE ${index + 1}
// ------------------------------------------------------------

// Evidence ID       : ${e.evidence_id || "N/A"}
// Agent             : ${e.agent || "N/A"}
// Task              : ${e.task || "N/A"}
// Status            : ${e.status || "N/A"}
// Confidence        : ${e.confidence != null
//             ? `${Math.round(
//               e.confidence <= 1
//                 ? e.confidence * 100
//                 : e.confidence
//             )}%`
//             : "N/A"
//           }

// Visual Evidence
// ------------------------------------------------------------
// ${visualEvidence}

// RAW FINDING
// ------------------------------------------------------------
// ${e.finding || "N/A"}

// VERIFIED FINDING
// ------------------------------------------------------------
// ${e.verified_finding || "N/A"}

// CHANGE STATISTICS
// ------------------------------------------------------------
// Changed Fraction  : ${changedFraction}
// Method            : ${stats.method || "N/A"}
// Threshold         : ${stats.threshold ?? "N/A"}
// Change BBox       : ${bbox}

// Boxes
// ------------------------------------------------------------
// ${Array.isArray(e.boxes)
//             ? JSON.stringify(e.boxes, null, 2)
//             : "None"
//           }
// `;
//       }).join("\n")
//       : "No evidence returned.";

//     // --------------------------------------------------
//     // EXECUTION TRACE
//     // --------------------------------------------------

//     const traceReport = Array.isArray(r.execution_trace)
//       ? r.execution_trace.map((step, index) => {

//         const details = Object.entries(step || {})
//           .filter(([key]) => key !== "node" && key !== "status")
//           .map(
//             ([key, value]) =>
//               `    ${toTitle(key)} : ${formatValue(value)}`
//           )
//           .join("\n");

//         return `
// ${String(index + 1).padStart(2, "0")}. ${toTitle(step.node) || "Unknown Node"}
//     Status : ${(step.status || "unknown").toUpperCase()}
// ${details || "    No additional metadata"}
// `;
//       }).join("\n")
//       : "No execution trace returned.";

//     // --------------------------------------------------
//     // ARTIFACTS
//     // --------------------------------------------------

//     const artifactReport = Array.isArray(r.artifacts)
//       ? r.artifacts.map((artifact, index) => `
// ------------------------------------------------------------
// ARTIFACT ${index + 1}
// ------------------------------------------------------------

// Artifact ID       : ${artifact.artifact_id || "N/A"}
// Kind              : ${artifact.kind || "N/A"}
// Produced By       : ${artifact.produced_by || "N/A"}
// Image Available   : ${artifact.image_b64 ? "YES" : "NO"}
// `).join("\n")
//       : "No artifacts returned.";

//     // --------------------------------------------------
//     // REFLECTION
//     // --------------------------------------------------

//     const reflectionReport = r.reflection
//       ? `
// Decision           : ${r.reflection.decision || "N/A"}
// Required Action    : ${r.reflection.required_action || "N/A"}
// Confidence         : ${reflectionConfidence}
// Evidence Confidence: ${evidenceConfidence}
// Minimum Confidence : ${minConfidence}
// Retry Count        : ${r.reflection.retry_count ?? 0}

// Reason
// ------------------------------------------------------------
// ${r.reflection.reason || "N/A"}
// `
//       : "No reflection information returned.";

//     // --------------------------------------------------
//     // VALIDATION
//     // --------------------------------------------------

//     const validationErrors =
//       Array.isArray(r.validation_errors) &&
//         r.validation_errors.length > 0
//         ? r.validation_errors
//           .map(error => `• ${error}`)
//           .join("\n")
//         : "None";

//     // --------------------------------------------------
//     // COMPLETE REPORT
//     // --------------------------------------------------

//     const reportText = `
// ============================================================
//                       SATQUERY AI
//              EARTH OBSERVATION ANALYSIS
//                        REPORT
// ============================================================

// REPORT INFORMATION
// ============================================================

// Report Version      : 1.0
// Generated At        : ${new Date().toLocaleString()}
// Conversation ID     : ${conversationId || "N/A"}
// User ID             : ${userId || "N/A"}


// QUERY
// ============================================================

// ${r.query || queryText || "N/A"}


// ANALYSIS SUMMARY
// ============================================================

// Current Task        : ${toTitle(r.current_task) || "N/A"}
// Temporal Mode       : ${toTitle(r.temporal_mode) || "N/A"}
// Image Count         : ${r.image_count ?? "N/A"}
// Modalities          : ${formatValue(r.modalities)}
// Input Valid         : ${formatValue(r.input_valid)}
// Retry Count         : ${r.retry_count ?? 0}
// Duration            : ${r.duration_seconds != null
//         ? `${Number(r.duration_seconds).toFixed(3)} seconds`
//         : "N/A"
//       }


// CONFIDENCE
// ============================================================

// Answer Confidence   : ${confidence}
// Reflection          : ${reflectionConfidence}
// Evidence Confidence : ${evidenceConfidence}
// Minimum Threshold   : ${minConfidence}


// VALIDATION
// ============================================================

// Input Valid         : ${r.input_valid ? "YES" : "NO"}

// Validation Errors:
// ${validationErrors}


// DECISION
// ============================================================

// Decision            : ${r.reflection?.decision || "N/A"}
// Required Action     : ${r.reflection?.required_action || "N/A"}


// FINAL ANSWER
// ============================================================

// ${answer}


// EVIDENCE
// ============================================================

// ${evidenceReport}


// EXECUTION TRACE
// ============================================================

// ${traceReport}


// REFLECTION
// ============================================================

// ${reflectionReport}


// ARTIFACTS
// ============================================================

// ${artifactReport}


// CHANGE DETECTION SUMMARY
// ============================================================

// ${r.evidence?.[0]?.change_stats
//         ? `
// Changed Fraction    : ${r.evidence[0].change_stats.changed_fraction != null
//           ? `${(
//             r.evidence[0].change_stats.changed_fraction * 100
//           ).toFixed(2)}%`
//           : "N/A"
//         }

// Method              : ${r.evidence[0].change_stats.method || "N/A"
//         }

// Threshold           : ${r.evidence[0].change_stats.threshold ?? "N/A"
//         }

// Change Bounding Box : ${Array.isArray(r.evidence[0].change_stats.change_bbox)
//           ? r.evidence[0].change_stats.change_bbox.join(", ")
//           : "N/A"
//         }
// `
//         : "No change statistics available."
//       }


// ============================================================
//                     END OF REPORT
// ============================================================
// `;

//     // --------------------------------------------------
//     // DOWNLOAD
//     // --------------------------------------------------

//     const blob = new Blob(
//       [reportText],
//       {
//         type: "text/plain;charset=utf-8"
//       }
//     );

//     const url = URL.createObjectURL(blob);

//     const a = document.createElement("a");

//     a.href = url;

//     a.download =
//       `satquery_analysis_report_${Date.now()}.txt`;

//     document.body.appendChild(a);

//     a.click();

//     document.body.removeChild(a);

//     URL.revokeObjectURL(url);
//   };

//   const extractMessageText = (item) => {
//     if (!item) return "";
//     if (typeof item === "string") return item;
//     if (item.content) {
//       if (typeof item.content === "string") return item.content;
//       if (item.content.content && typeof item.content.content === "string") {
//         return item.content.content;
//       }
//     }
//     if (item.message && typeof item.message === "string") return item.message;
//     return "";
//   };

//   useEffect(() => {
//     if (!isLoading || analysisComplete) return;

//     const interval = setInterval(() => {
//       setTimelineStep(prev => (prev < 6 ? prev + 1 : 6));
//     }, 450);

//     return () => clearInterval(interval);
//   }, [isLoading, analysisComplete]);

//   useEffect(() => {
//     socket.connect();

//     socket.on("connect", () => {
//       console.log("Socket connected:", socket.id);
//     });

//     socket.on("message:response", (data) => {
//       console.log("AI RESPONSE:", data);
//       setRawBackendResponse(data);
//       setTimelineStep(6);

//       if (data?.conversationId) {
//         setConversationId(data.conversationId);
//       }

//       let aiText = "";
//       if (data?.assistantMessage) {
//         aiText = extractMessageText(data.assistantMessage);
//       } else if (data?.message) {
//         aiText = extractMessageText(data.message);
//       }

//       const hasResultShape = (o) => o && typeof o === 'object' && (
//         o.final_answer !== undefined || o.execution_trace !== undefined ||
//         o.evidence !== undefined || o.reflection !== undefined
//       );

//       const backendMeta =
//         (hasResultShape(data?.assistantMessage?.metadata) && data.assistantMessage.metadata) ||
//         (hasResultShape(data?.assistantMessage?.content?.metadata) && data.assistantMessage.content.metadata) ||
//         (hasResultShape(data?.metadata) && data.metadata) ||
//         (hasResultShape(data?.result) && data.result) ||
//         (hasResultShape(data) && data) ||
//         data?.assistantMessage?.metadata ||
//         data?.assistantMessage?.content?.metadata ||
//         data?.metadata ||
//         null;

//       if (backendMeta && typeof backendMeta === 'object') {
//         setBackendResult(backendMeta);
//         setOpenTraceSteps({});
//         setOverviewImageMode('change');
//       }

//       const backendEvidence = backendMeta?.evidence;
//       if (backendEvidence && Array.isArray(backendEvidence)) {
//         setEvidenceList(backendEvidence);
//       }
//       if (backendMeta?.execution_trace && Array.isArray(backendMeta.execution_trace)) {
//         setExecutionTrace(backendMeta.execution_trace);
//       }
//       if (backendMeta?.duration_seconds) {
//         setDurationSeconds(backendMeta.duration_seconds);
//       }

//       const finalText = aiText || backendMeta?.final_answer || "";
//       if (finalText) {
//         setLatestAiAnswer(finalText);
//         setMessages(prev => [...prev, { role: 'assistant', content: finalText }]);
//       }

//       setIsLoading(false);
//       setAnalysisComplete(true);

//       const activeConvId = data?.conversationId || conversationId;
//       try {
//         const existing = JSON.parse(localStorage.getItem('satquery_local_history') || '[]');
//         if (existing.length > 0) {
//           const targetIndex = activeConvId
//             ? existing.findIndex(c => c.id === activeConvId)
//             : 0;

//           if (targetIndex >= 0 && targetIndex < existing.length) {
//             const item = existing[targetIndex];
//             const confVal = backendMeta?.confidence != null
//               ? `${Math.round(backendMeta.confidence <= 1 ? backendMeta.confidence * 100 : backendMeta.confidence)}%`
//               : (item.confidence || '85%');

//             item.status = 'COMPLETE';
//             item.confidence = confVal;
//             if (backendMeta?.temporal_mode) {
//               item.mode = backendMeta.image_count > 1 ? 'Bi-Temporal' : 'Single Image';
//             }

//             const hasAssistantMsg = item.rawMessages?.some(m => m.role === 'ASSISTANT');
//             if (!hasAssistantMsg && finalText) {
//               if (!item.rawMessages) item.rawMessages = [];
//               item.rawMessages.push({
//                 id: `msg_ai_${Date.now()}`,
//                 role: 'ASSISTANT',
//                 content: finalText,
//                 createdAt: new Date().toISOString(),
//                 metadata: backendMeta || {}
//               });
//             }
//             localStorage.setItem('satquery_local_history', JSON.stringify(existing));
//           }
//         }
//       } catch (err) {
//         console.error('Error updating local history:', err);
//       }
//     });

//     socket.on("message:error", (error) => {
//       console.log("❌ BACKEND ERROR:", error);
//       setIsLoading(false);
//       setAnalysisComplete(true);
//       setTimelineStep(0);
//       let cleanMsg = (typeof error === 'object' && error?.message)
//         ? error.message
//         : (typeof error === 'string' ? error : "An error occurred while communicating with the backend.");

//       if (typeof cleanMsg === 'string' && cleanMsg.toLowerCase().includes("conversation not found")) {
//         setConversationId(null);
//       }

//       if (typeof cleanMsg === 'string' && (cleanMsg.includes('<!DOCTYPE') || cleanMsg.includes('<html'))) {
//         if (cleanMsg.includes('ERR_NGROK') || cleanMsg.includes('ngrok')) {
//           cleanMsg = "ML API failed: The ML model server (ngrok tunnel 'respect-tigress-retorted.ngrok-free.dev') is offline.";
//         } else {
//           cleanMsg = "ML API failed: Server returned a 404 HTML error response.";
//         }
//       }

//       setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ Backend Notice: ${cleanMsg}` }]);
//     });

//     return () => {
//       socket.off("connect");
//       socket.off("message:response");
//       socket.off("message:error");
//       socket.disconnect();
//     };
//   }, [conversationId]);

//   const handleFileUpload = (e) => {
//     if (e.target.files && e.target.files.length > 0) {
//       const selectedFiles = Array.from(e.target.files);
//       const availableSlots = 2 - uploadedFiles.length;

//       if (availableSlots <= 0) {
//         setUploadError('You can upload a maximum of 2 images.');
//         e.target.value = '';
//         return;
//       }

//       const imageFiles = selectedFiles.filter(file => file.type.startsWith('image/'));
//       const newFiles = imageFiles.slice(0, availableSlots).map(f => ({
//         name: f.name,
//         preview: URL.createObjectURL(f),
//         file: f,
//       }));

//       if (imageFiles.length !== selectedFiles.length) {
//         setUploadError('Only image files can be uploaded.');
//       } else if (selectedFiles.length > availableSlots) {
//         setUploadError('You can upload a maximum of 2 images.');
//       } else {
//         setUploadError('');
//       }

//       setUploadedFiles(prev => [...prev, ...newFiles]);
//       setIsPopupOpen(false);
//       e.target.value = '';
//     }
//   };

//   const handleDriveUpload = () => {
//     if (uploadedFiles.length >= 2) {
//       setUploadError('You can upload a maximum of 2 images.');
//       return;
//     }

//     setUploadedFiles(prev => [...prev, {
//       name: "Drive_Image_Selected.tif",
//       preview: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=200&q=80",
//       file: null,
//     }]);
//     setUploadError('');
//     setIsPopupOpen(false);
//   };

//   const removeFile = (index) => {
//     setUploadedFiles(prev => prev.filter((_, i) => i !== index));
//     setUploadError('');
//   };

//   const handleSend = async () => {
//     const currentQuery = inputValue.trim();
//     if (uploadedFiles.length === 0) {
//       setUploadError('Please upload a satellite image to start analysis.');
//       return;
//     }

//     const currentFiles = [...uploadedFiles];
//     const isLocalId = !conversationId || conversationId.startsWith('conv_local_');
//     const newConvId = isLocalId ? `conv_local_${Date.now()}` : conversationId;

//     setUploadError('');
//     setQueryText(currentQuery);
//     setSentFiles(currentFiles);
//     setHasQueried(true);
//     setIsLoading(true);
//     setAnalysisComplete(false);
//     setTimelineStep(0);
//     setActiveResultTab('overview');

//     const imagesBase64 = [];
//     const imagesDataUrls = [];

//     for (const uploadedFile of currentFiles) {
//       const file = uploadedFile.file;

//       if (!file) {
//         if (uploadedFile.preview) imagesDataUrls.push(uploadedFile.preview);
//         continue;
//       }

//       try {
//         const dataUrl = await new Promise((resolve, reject) => {
//           const reader = new FileReader();
//           reader.onload = () => resolve(reader.result);
//           reader.onerror = reject;
//           reader.readAsDataURL(file);
//         });

//         imagesDataUrls.push(dataUrl);
//         const base64Str = dataUrl.split(',')[1];
//         if (base64Str) imagesBase64.push(base64Str);
//       } catch (err) {
//         console.error("❌ Failed to convert image:", err);
//       }
//     }

//     // Create local history entry with persistent Data URLs
//     try {
//       const newHistoryItem = {
//         id: newConvId,
//         title: currentQuery || 'Satellite image analysis',
//         date: new Date().toISOString(),
//         mode: currentFiles.length > 1 ? 'Bi-Temporal' : (currentFiles.length === 1 ? 'Single Image' : 'Single Image'),
//         confidence: null,
//         status: 'PENDING',
//         rawMessages: [
//           {
//             id: `msg_user_${Date.now()}`,
//             role: 'USER',
//             content: currentQuery || 'Analyze uploaded satellite image',
//             createdAt: new Date().toISOString(),
//             images: imagesDataUrls.length > 0 ? imagesDataUrls : currentFiles.map(f => f.preview)
//           }
//         ]
//       };

//       const existing = JSON.parse(localStorage.getItem('satquery_local_history') || '[]');
//       const filtered = existing.filter(c => c.id !== newConvId);
//       filtered.unshift(newHistoryItem);
//       localStorage.setItem('satquery_local_history', JSON.stringify(filtered));
//     } catch (err) {
//       console.error('Error saving local history entry:', err);
//     }

//     const payload = {
//       key: SOCKET_KEY,
//       userId,
//       message: currentQuery,
//       images: imagesBase64,
//     };

//     if (conversationId && !conversationId.startsWith('conv_local_')) {
//       payload.conversationId = conversationId;
//     }

//     socket.emit("message:send", payload);

//     setInputValue('');
//     setUploadedFiles([]);
//   };

//   const handleKeyDown = (e) => {
//     if (e.key === 'Enter') {
//       handleSend();
//     }
//   };

//   // ---- Backend result (ar.txt shape) derived views ----
//   const R = backendResult || {};
//   const evidenceItems = (Array.isArray(R.evidence) && R.evidence.length) ? R.evidence : evidenceList;
//   const traceSteps = (Array.isArray(R.execution_trace) && R.execution_trace.length) ? R.execution_trace : executionTrace;
//   const artifacts = Array.isArray(R.artifacts) ? R.artifacts : [];
//   const reflection = R.reflection || null;
//   const totalDuration = R.duration_seconds ?? durationSeconds;
//   const changeMapArtifact = artifacts.find(a => a && a.image_b64) || null;
//   const artifactForEvidence = (ev) =>
//     artifacts.find(a => ev?.evidence_id && a?.artifact_id && a.artifact_id.startsWith(ev.evidence_id)) || null;
//   const overallConfidence = R.confidence ?? evidenceItems?.[0]?.confidence;
//   const primaryEvidence = evidenceItems?.[0] || null;
//   const changeStats = primaryEvidence?.change_stats || null;
//   const sourcePreview = sentFiles.length > 0 ? sentFiles[0].preview : null;
//   const showChangeMap = overviewImageMode === 'change' && !!changeMapArtifact;
//   const overviewImage = showChangeMap
//     ? changeMapArtifact.image_b64
//     : (sourcePreview || 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80');
//   const bbox = Array.isArray(changeStats?.change_bbox) && changeStats.change_bbox.length === 4
//     ? changeStats.change_bbox : null;

//   const searchBarElement = (
//     <div className="search-bar-wrapper">
//       <div className={`search-bar ${uploadedFiles.length > 0 ? 'has-files' : ''}`}>

//         {uploadedFiles.length > 0 && (
//           <div className="uploaded-files-preview">
//             {uploadedFiles.map((file, i) => (
//               <div className="file-preview-card" key={i}>
//                 <div className="remove-file-badge" onClick={() => removeFile(i)}>×</div>
//                 <div className="file-thumbnail" style={{ backgroundImage: `url('${file.preview}')` }}></div>
//               </div>
//             ))}
//           </div>
//         )}

//         <div className="search-input-row">
//           <div
//             className={`search-plus-icon ${isPopupOpen ? 'open' : ''}`}
//             onClick={() => setIsPopupOpen(!isPopupOpen)}
//           >
//             {isPopupOpen ? (
//               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
//                 <line x1="18" y1="6" x2="6" y2="18"></line>
//                 <line x1="6" y1="6" x2="18" y2="18"></line>
//               </svg>
//             ) : (
//               <svg width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="2">
//                 <line x1="12" y1="5" x2="12" y2="19"></line>
//                 <line x1="5" y1="12" x2="19" y2="12"></line>
//               </svg>
//             )}
//           </div>

//           {isPopupOpen && (
//             <div className="search-popup-menu">
//               <div className="popup-item" onClick={() => fileInputRef.current.click()}>
//                 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
//                 Upload files
//               </div>
//               <div className="popup-item" onClick={handleDriveUpload}>
//                 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>
//                 Add from Drive
//               </div>
//               <div className="popup-item more-uploads">
//                 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
//                 More uploads
//                 <span className="arrow-right">&gt;</span>
//               </div>
//             </div>
//           )}

//           <input
//             type="text"
//             placeholder="Ask Anything"
//             className="search-input"
//             value={inputValue}
//             onChange={(e) => setInputValue(e.target.value)}
//             onKeyDown={handleKeyDown}
//           />
//           {inputValue.trim() !== '' || uploadedFiles.length > 0 ? (
//             <div
//               className="search-send-btn"
//               onClick={handleSend}
//             >
//               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
//                 <line x1="12" y1="19" x2="12" y2="5"></line>
//                 <polyline points="5 12 12 5 19 12"></polyline>
//               </svg>
//             </div>
//           ) : (
//             <div className="search-mic-icon">
//               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
//                 <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
//                 <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
//                 <line x1="12" y1="19" x2="12" y2="23"></line>
//                 <line x1="8" y1="23" x2="16" y2="23"></line>
//               </svg>
//             </div>
//           )}
//         </div>

//         {uploadError && (
//           <div className="upload-error" role="alert">{uploadError}</div>
//         )}

//         <input
//           type="file"
//           multiple
//           accept="image/*"
//           style={{ display: 'none' }}
//           ref={fileInputRef}
//           onChange={handleFileUpload}
//         />
//       </div>
//     </div>
//   );

//   return (
//     <div className="searchpage-container">
//       {!isLoggedIn && !hasQueried && (
//         <div className="search-header-auth">
//           <button className="auth-btn-login" onClick={onLogin}>Log in</button>
//           <button className="auth-btn-signup" onClick={onSignup}>Sign up for free</button>
//         </div>
//       )}

//       <div className="collapsed-sidebar" onClick={() => setIsSidebarOpen(true)}>
//         <div className="sidebar-icons">
//           <div className="sidebar-logo">
//             <svg width="47" height="46" viewBox="0 0 47 46" fill="none" stroke="black" strokeWidth="1.5">
//               <circle cx="23.5" cy="23" r="21"></circle>
//               <ellipse cx="23.5" cy="23" rx="21" ry="6" transform="rotate(-25 23.5 23)"></ellipse>
//               <circle cx="23.5" cy="23" r="3.5" fill="#00B4D8" stroke="none"></circle>
//             </svg>
//           </div>

//           <div className="icon-group">
//             <div
//               className="sidebar-icon"
//               title="Open dashboard"
//               onClick={(event) => {
//                 event.stopPropagation();
//                 handleProtectedNavigate('dashboard');
//               }}
//             >
//               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
//                 <rect x="3" y="3" width="7" height="7"></rect>
//                 <rect x="14" y="3" width="7" height="7"></rect>
//                 <rect x="14" y="14" width="7" height="7"></rect>
//                 <rect x="3" y="14" width="7" height="7"></rect>
//               </svg>
//             </div>
//             <div
//               className="sidebar-icon"
//               title="Open history"
//               onClick={(event) => {
//                 event.stopPropagation();
//                 handleProtectedNavigate('history');
//               }}
//             >
//               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
//                 <circle cx="12" cy="12" r="10"></circle>
//                 <polyline points="12 6 12 12 16 14"></polyline>
//               </svg>
//             </div>
//             <div
//               className="sidebar-icon"
//               title="Open reports"
//               onClick={(event) => {
//                 event.stopPropagation();
//                 handleProtectedNavigate('reports');
//               }}
//             >
//               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
//                 <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
//                 <polyline points="14 2 14 8 20 8"></polyline>
//                 <line x1="16" y1="13" x2="8" y2="13"></line>
//                 <line x1="16" y1="17" x2="8" y2="17"></line>
//                 <polyline points="10 9 9 9 8 9"></polyline>
//               </svg>
//             </div>
//             <div
//               className="sidebar-icon"
//               title="Settings"
//               onClick={(event) => {
//                 event.stopPropagation();
//                 handleProtectedNavigate('settings');
//               }}
//             >
//               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
//                 <circle cx="12" cy="12" r="3"></circle>
//                 <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
//               </svg>
//             </div>
//           </div>
//         </div>
//       </div>

//       {isSidebarOpen && (
//         <div className="search-sidebar-layer" role="dialog" aria-modal="true" aria-label="Navigation menu">
//           <button
//             className="search-sidebar-backdrop"
//             aria-label="Close navigation menu"
//             onClick={() => setIsSidebarOpen(false)}
//           />
//           <aside className="search-sidebar-panel">
//             <button
//               className="search-sidebar-close"
//               aria-label="Close navigation menu"
//               onClick={() => setIsSidebarOpen(false)}
//             >
//               ×
//             </button>

//             <div className="search-sidebar-brand">
//               <svg width="42" height="42" viewBox="0 0 47 46" fill="none" stroke="black" strokeWidth="1.5" aria-hidden="true">
//                 <circle cx="23.5" cy="23" r="21"></circle>
//                 <ellipse cx="23.5" cy="23" rx="21" ry="6" transform="rotate(-25 23.5 23)"></ellipse>
//                 <circle cx="23.5" cy="23" r="3.5" fill="#00B4D8" stroke="none"></circle>
//               </svg>
//               <strong>SATQUERY <span>AI</span></strong>
//             </div>

//             <button className="search-sidebar-new" onClick={handleNewAnalysis}>
//               <span>+</span> New Analysis
//             </button>

//             <nav className="search-sidebar-nav">
//               <button className="search-sidebar-nav-item" onClick={() => { setIsSidebarOpen(false); handleProtectedNavigate('dashboard'); }}>
//                 <span className="sidebar-nav-icon">▦</span> Dashboard
//               </button>
//               <button className="search-sidebar-nav-item" onClick={() => { setIsSidebarOpen(false); handleProtectedNavigate('history'); }}>
//                 <span className="sidebar-nav-icon">◷</span> History
//               </button>
//               <button className="search-sidebar-nav-item" onClick={() => { setIsSidebarOpen(false); handleProtectedNavigate('reports'); }}>
//                 <span className="sidebar-nav-icon">▤</span> Reports
//               </button>
//               <button className="search-sidebar-nav-item" onClick={() => { setIsSidebarOpen(false); handleProtectedNavigate('settings'); }}>
//                 <span className="sidebar-nav-icon">⚙</span> Settings
//               </button>
//             </nav>

//             {!isLoggedIn ? (
//               <div className="sidebar-auth-promo-card">
//                 <div className="promo-card-title">Get responses tailored to you</div>
//                 <div className="promo-card-sub">
//                   Log in to save chats, view analysis history & access dashboard.
//                 </div>
//                 <button className="promo-card-login-btn" onClick={onLogin}>
//                   Log in
//                 </button>
//               </div>
//             ) : (
//               <div className="search-sidebar-profile">
//                 <div className="search-sidebar-avatar">
//                   {(user?.fullName || user?.email || 'M')[0].toUpperCase()}
//                 </div>
//                 <div className="profile-text-col">
//                   <strong>{user?.fullName || 'Mayank'}</strong>
//                 </div>
//                 <button className="logout-icon-btn" title="Log out" onClick={onLogout}>
//                   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
//                     <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
//                     <polyline points="16 17 21 12 16 7"></polyline>
//                     <line x1="21" y1="12" x2="9" y2="12"></line>
//                   </svg>
//                 </button>
//               </div>
//             )}
//           </aside>
//         </div>
//       )}

//       {showAuthModal && (
//         <div className="auth-modal-backdrop" onClick={() => setShowAuthModal(false)}>
//           <div className="auth-modal-content" onClick={(e) => e.stopPropagation()}>
//             <button className="auth-modal-close-btn" onClick={() => setShowAuthModal(false)}>×</button>
//             <div className="auth-modal-brand-logo">
//               <svg width="42" height="42" viewBox="0 0 47 46" fill="none" stroke="black" strokeWidth="1.5">
//                 <circle cx="23.5" cy="23" r="21"></circle>
//                 <ellipse cx="23.5" cy="23" rx="21" ry="6" transform="rotate(-25 23.5 23)"></ellipse>
//                 <circle cx="23.5" cy="23" r="3.5" fill="#00B4D8" stroke="none"></circle>
//               </svg>
//             </div>
//             <h2 className="auth-modal-title">Sign in to access {authModalFeature ? authModalFeature.toUpperCase() : 'History & Dashboard'}</h2>
//             <p className="auth-modal-desc">
//               Log in or create a free account to save your satellite queries, view past analysis history, and download reports.
//             </p>
//             <div className="auth-modal-btn-group">
//               <button className="modal-btn-login" onClick={() => { setShowAuthModal(false); if (onLogin) onLogin(); }}>
//                 Log in
//               </button>
//               <button className="modal-btn-signup" onClick={() => { setShowAuthModal(false); if (onSignup) onSignup(); }}>
//                 Sign up for free
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       <div className={`searchpage-content ${hasQueried ? 'has-results' : ''}`}>
//         {!hasQueried ? (
//           <div className="initial-search-container">
//             {searchBarElement}
//           </div>
//         ) : (
//           <div className="results-container">
//             <div className="chat-section">
//               <div className="chat-history">
//                 {sentFiles.length > 0 && (
//                   <div className="message user-message image-message" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', backgroundColor: 'transparent', padding: '0', boxShadow: 'none' }}>
//                     {sentFiles.map((f, i) => (
//                       <img key={i} src={f.preview} alt="uploaded" style={{ maxWidth: '200px', maxHeight: '150px', borderRadius: '12px', objectFit: 'cover' }} />
//                     ))}
//                   </div>
//                 )}
//                 {queryText && (
//                   <div className="message user-message">{queryText}</div>
//                 )}
//                 {messages.length > 0 ? (
//                   messages.map((msg, idx) => (
//                     <div
//                       key={idx}
//                       className={`message ${(msg.role === 'user' || msg.role === 'USER') ? 'user-message' : 'ai-message'}`}
//                     >
//                       {(msg.role === 'user' || msg.role === 'USER') ? msg.content : renderStructuredText(msg.content)}
//                     </div>
//                   ))
//                 ) : (
//                   isLoading && (
//                     <div className="message ai-message">
//                       Processing your satellite imagery query...
//                     </div>
//                   )
//                 )}
//                 {isLoading && (
//                   <div className="loading-dots">
//                     <span className="dot"></span><span className="dot"></span><span className="dot"></span>
//                   </div>
//                 )}
//               </div>
//               <div className="chat-input-area">
//                 {searchBarElement}
//               </div>
//             </div>

//             <div className="analysis-section">
//               {analysisComplete ? (
//                 <div className="analysis-results-card">
//                   <div className="results-header-top">
//                     <div className="badge-complete">
//                       <span className="dot-circle"></span>
//                       ANALYSIS COMPLETE
//                     </div>
//                     <div className="results-actions">
//                       <button className="btn-secondary" onClick={handleExportJson}>Export JSON</button>
//                       <button className="btn-primary" onClick={handleDownloadReport}>Download Report</button>
//                     </div>
//                   </div>

//                   <h2 className="results-title">Analysis Results</h2>
//                   <div className="results-query">
//                     Query: "{R.query || queryText || 'Describe this image .'}"
//                     {R.current_task && <span className="query-task-pill">{toTitle(R.current_task)}</span>}
//                     {R.temporal_mode && <span className="query-task-pill alt">{toTitle(R.temporal_mode)}</span>}
//                   </div>

//                   <div className="results-tabs">
//                     <button
//                       className={`result-tab-btn ${activeResultTab === 'overview' ? 'active' : ''}`}
//                       onClick={() => setActiveResultTab('overview')}
//                     >
//                       Overview
//                     </button>
//                     <button
//                       className={`result-tab-btn ${activeResultTab === 'evidence' ? 'active' : ''}`}
//                       onClick={() => setActiveResultTab('evidence')}
//                     >
//                       Evidence{evidenceItems.length > 0 ? ` (${evidenceItems.length})` : ''}
//                     </button>
//                     <button
//                       className={`result-tab-btn ${activeResultTab === 'layers' ? 'active' : ''}`}
//                       onClick={() => setActiveResultTab('layers')}
//                     >
//                       Artifacts{artifacts.length > 0 ? ` (${artifacts.length})` : ''}
//                     </button>
//                     <button
//                       className={`result-tab-btn ${activeResultTab === 'trace' ? 'active' : ''}`}
//                       onClick={() => setActiveResultTab('trace')}
//                     >
//                       Agent Trace
//                     </button>
//                     <button
//                       className={`result-tab-btn ${activeResultTab === 'metadata' ? 'active' : ''}`}
//                       onClick={() => setActiveResultTab('metadata')}
//                     >
//                       Metadata
//                     </button>
//                   </div>

//                   {activeResultTab === 'overview' && (
//                     <>
//                       <div className="results-overview-grid">
//                         <div
//                           className={`evidence-image-container${showChangeMap ? ' contain-img' : ''}`}
//                           style={{ backgroundImage: `url("${overviewImage}")` }}
//                         >
//                           {showChangeMap && showEvidence && bbox && (
//                             <div
//                               className="bounding-box cyan"
//                               style={{
//                                 left: `${bbox[0] * 100}%`,
//                                 top: `${bbox[1] * 100}%`,
//                                 width: `${(bbox[2] - bbox[0]) * 100}%`,
//                                 height: `${(bbox[3] - bbox[1]) * 100}%`,
//                               }}
//                             >
//                               <span className="box-label cyan">
//                                 CHANGE {changeStats?.changed_fraction != null ? asPercent(changeStats.changed_fraction) : ''}
//                               </span>
//                             </div>
//                           )}
//                           {changeMapArtifact && (
//                             <div className="img-mode-toggle">
//                               <button
//                                 className={overviewImageMode === 'change' ? 'active' : ''}
//                                 onClick={() => setOverviewImageMode('change')}
//                               >CHANGE MAP</button>
//                               <button
//                                 className={overviewImageMode === 'source' ? 'active' : ''}
//                                 onClick={() => setOverviewImageMode('source')}
//                               >SOURCE</button>
//                             </div>
//                           )}
//                           {showChangeMap && bbox && (
//                             <button
//                               className="hide-evidence-btn"
//                               onClick={() => setShowEvidence(!showEvidence)}
//                             >
//                               {showEvidence ? 'HIDE BOX' : 'SHOW BOX'}
//                             </button>
//                           )}
//                         </div>

//                         <div className="synthesis-text-container">
//                           <div className="synthesis-heading">GLOBAL SYNTHESIS</div>
//                           <div className="synthesis-content">
//                             {(R.final_answer || latestAiAnswer) ? (
//                               renderStructuredText(R.final_answer || latestAiAnswer)
//                             ) : (
//                               <p>Awaiting synthesised answer from the analysis pipeline.</p>
//                             )}
//                           </div>
//                         </div>
//                       </div>

//                       <div className="results-bottom-row">
//                         <div className="confidence-box">
//                           <div className="box-subtitle">AI CONFIDENCE</div>
//                           <div className="confidence-large-number">{asPercent(overallConfidence)}</div>
//                           {[
//                             { label: 'Answer Confidence', value: overallConfidence },
//                             { label: 'Reflection Confidence', value: reflection?.confidence },
//                             { label: 'Evidence Confidence', value: reflection?.evidence_confidence ?? primaryEvidence?.confidence },
//                             { label: 'Min Threshold', value: reflection?.min_confidence },
//                           ].filter(m => m.value != null).map((m, i) => {
//                             const w = (m.value <= 1 ? m.value * 100 : m.value);
//                             return (
//                               <div className="confidence-metric-item" key={i}>
//                                 <div className="metric-text-row">
//                                   <span>{m.label}</span>
//                                   <span>{asPercent(m.value)}</span>
//                                 </div>
//                                 <div className="metric-bar-bg">
//                                   <div className="metric-bar-fill" style={{ width: `${w}%` }}></div>
//                                 </div>
//                               </div>
//                             );
//                           })}
//                         </div>

//                         <div className="model-details-box">
//                           <div className="box-subtitle">ANALYSIS</div>
//                           <div className="model-name">{toTitle(R.current_task) || 'Earth Observation'}</div>
//                           <div className="model-spec-table">
//                             <div className="model-spec-row">
//                               <span>Temporal Mode</span>
//                               <span>{toTitle(R.temporal_mode) || '—'}</span>
//                             </div>
//                             <div className="model-spec-row">
//                               <span>Images</span>
//                               <span>{R.image_count ?? '—'}</span>
//                             </div>
//                             <div className="model-spec-row">
//                               <span>Modalities</span>
//                               <span>{formatValue(R.modalities)}</span>
//                             </div>
//                             <div className="model-spec-row">
//                               <span>Retries</span>
//                               <span>{R.retry_count ?? 0}</span>
//                             </div>
//                             <div className="model-spec-row">
//                               <span>Decision</span>
//                               <span className="status-pill-green">{reflection?.decision || (R.input_valid ? 'Valid' : '—')}</span>
//                             </div>
//                           </div>
//                         </div>
//                       </div>

//                       {changeStats && (
//                         <div className="change-stats-strip">
//                           <div className="box-subtitle">CHANGE STATISTICS</div>
//                           <div className="change-stats-grid">
//                             <KV label="Changed Fraction" value={asPercent(changeStats.changed_fraction)} />
//                             <KV label="Method" value={toTitle(changeStats.method)} />
//                             <KV label="Threshold" value={formatValue(changeStats.threshold)} />
//                             <KV label="Change BBox" value={bbox ? bbox.map(n => Number(n).toFixed(3)).join(', ') : '—'} />
//                           </div>
//                         </div>
//                       )}
//                     </>
//                   )}

//                   {activeResultTab === 'trace' && (
//                     <div className="agent-trace-container">
//                       <div className="trace-top-bar">
//                         <div className="agent-trace-meta" style={{ marginBottom: 0 }}>
//                           EXECUTION TRACE — {traceSteps.length} {traceSteps.length === 1 ? 'STEP' : 'STEPS'}
//                           {totalDuration != null && ` • ${Number(totalDuration).toFixed(2)}s TOTAL`}
//                           {R.retry_count != null && ` • ${R.retry_count} RETRIES`}
//                         </div>
//                         {traceSteps.length > 0 && (
//                           <button className="trace-toggle-all-btn" onClick={() => toggleAllTraceSteps(traceSteps.length)}>
//                             {traceSteps.some((_, i) => isStepOpen(i)) ? 'Collapse All' : 'Expand All'}
//                           </button>
//                         )}
//                       </div>

//                       {traceSteps.length === 0 && (
//                         <div className="empty-note">No execution trace returned by the backend.</div>
//                       )}

//                       {traceSteps.map((step, i) => {
//                         const extraKeys = Object.keys(step || {}).filter(k => k !== 'node' && k !== 'status');
//                         const done = String(step?.status || '').toLowerCase() === 'completed';
//                         return (
//                           <div className="trace-step-card" key={i}>
//                             <div className="trace-step-header" onClick={() => toggleTraceStep(i)}>
//                               <div className="trace-step-left">
//                                 <span className="trace-step-number">{String(i + 1).padStart(2, '0')}</span>
//                                 <span className="trace-step-title">{toTitle(step?.node) || `Step ${i + 1}`}</span>
//                               </div>
//                               <div className="trace-step-right">
//                                 <span className={done ? 'trace-status-complete' : 'trace-status-pending'}>
//                                   {done ? '✓ ' : ''}{(step?.status || 'unknown').toUpperCase()}
//                                 </span>
//                                 <span className="trace-chevron">{isStepOpen(i) ? '▲' : '▼'}</span>
//                               </div>
//                             </div>
//                             {isStepOpen(i) && (
//                               <div className="trace-step-details">
//                                 {extraKeys.length === 0 && (
//                                   <div className="trace-detail-col"><span className="trace-detail-val">No additional data</span></div>
//                                 )}
//                                 {extraKeys.map(k => (
//                                   <div className="trace-detail-col" key={k}>
//                                     <span className="trace-detail-label">{toTitle(k)}</span>
//                                     <span className="trace-detail-val">{formatValue(step[k])}</span>
//                                   </div>
//                                 ))}
//                               </div>
//                             )}
//                           </div>
//                         );
//                       })}

//                       {reflection && (
//                         <div className="reflection-card">
//                           <div className="metadata-card-header">REFLECTION</div>
//                           <div className="metadata-grid-specs">
//                             <div className="meta-spec-item">
//                               <span className="meta-spec-label">DECISION</span>
//                               <span className="meta-spec-value">{reflection.decision || '—'}</span>
//                             </div>
//                             <div className="meta-spec-item">
//                               <span className="meta-spec-label">REQUIRED ACTION</span>
//                               <span className="meta-spec-value">{reflection.required_action || '—'}</span>
//                             </div>
//                             <div className="meta-spec-item">
//                               <span className="meta-spec-label">CONFIDENCE</span>
//                               <span className="meta-spec-value">{asPercent(reflection.confidence)}</span>
//                             </div>
//                             <div className="meta-spec-item">
//                               <span className="meta-spec-label">EVIDENCE CONFIDENCE</span>
//                               <span className="meta-spec-value">{asPercent(reflection.evidence_confidence)}</span>
//                             </div>
//                             <div className="meta-spec-item">
//                               <span className="meta-spec-label">MIN CONFIDENCE</span>
//                               <span className="meta-spec-value">{asPercent(reflection.min_confidence)}</span>
//                             </div>
//                             <div className="meta-spec-item">
//                               <span className="meta-spec-label">RETRY COUNT</span>
//                               <span className="meta-spec-value">{reflection.retry_count ?? 0}</span>
//                             </div>
//                           </div>
//                           {reflection.reason && (
//                             <pre className="evidence-finding-pre">{reflection.reason}</pre>
//                           )}
//                         </div>
//                       )}
//                     </div>
//                   )}

//                   {activeResultTab === 'metadata' && (
//                     <div className="metadata-tab-container">
//                       <div className="metadata-card">
//                         <div className="metadata-card-header">ANALYSIS METADATA</div>
//                         <div className="metadata-grid-specs">
//                           <div className="meta-spec-item">
//                             <span className="meta-spec-label">QUERY</span>
//                             <span className="meta-spec-value">{R.query || queryText || '—'}</span>
//                           </div>
//                           <div className="meta-spec-item">
//                             <span className="meta-spec-label">CURRENT TASK</span>
//                             <span className="meta-spec-value">{toTitle(R.current_task) || '—'}</span>
//                           </div>
//                           <div className="meta-spec-item">
//                             <span className="meta-spec-label">TEMPORAL MODE</span>
//                             <span className="meta-spec-value">{toTitle(R.temporal_mode) || '—'}</span>
//                           </div>
//                           <div className="meta-spec-item">
//                             <span className="meta-spec-label">IMAGE COUNT</span>
//                             <span className="meta-spec-value">{R.image_count ?? '—'}</span>
//                           </div>
//                           <div className="meta-spec-item">
//                             <span className="meta-spec-label">MODALITIES</span>
//                             <span className="meta-spec-value">{formatValue(R.modalities)}</span>
//                           </div>
//                           <div className="meta-spec-item">
//                             <span className="meta-spec-label">INPUT VALID</span>
//                             <span className="meta-spec-value">{formatValue(R.input_valid)}</span>
//                           </div>
//                           <div className="meta-spec-item">
//                             <span className="meta-spec-label">VALIDATION ERRORS</span>
//                             <span className="meta-spec-value">
//                               {Array.isArray(R.validation_errors) && R.validation_errors.length
//                                 ? R.validation_errors.join('; ') : 'None'}
//                             </span>
//                           </div>
//                           <div className="meta-spec-item">
//                             <span className="meta-spec-label">RETRY COUNT</span>
//                             <span className="meta-spec-value">{R.retry_count ?? '—'}</span>
//                           </div>
//                           <div className="meta-spec-item">
//                             <span className="meta-spec-label">ANSWER CONFIDENCE</span>
//                             <span className="meta-spec-value">{asPercent(R.confidence)}</span>
//                           </div>
//                           <div className="meta-spec-item">
//                             <span className="meta-spec-label">DURATION</span>
//                             <span className="meta-spec-value">{totalDuration != null ? `${Number(totalDuration).toFixed(2)}s` : '—'}</span>
//                           </div>
//                           <div className="meta-spec-item">
//                             <span className="meta-spec-label">EVIDENCE ITEMS</span>
//                             <span className="meta-spec-value">{evidenceItems.length}</span>
//                           </div>
//                           <div className="meta-spec-item">
//                             <span className="meta-spec-label">ARTIFACTS</span>
//                             <span className="meta-spec-value">{artifacts.length}</span>
//                           </div>
//                         </div>
//                       </div>

//                       {reflection && (
//                         <div className="metadata-card" style={{ marginTop: '12px' }}>
//                           <div className="metadata-card-header">REFLECTION</div>
//                           <div className="metadata-grid-specs">
//                             {Object.entries(reflection).filter(([k]) => k !== 'reason').map(([k, v]) => (
//                               <div className="meta-spec-item" key={k}>
//                                 <span className="meta-spec-label">{toTitle(k)}</span>
//                                 <span className="meta-spec-value">
//                                   {typeof v === 'number' && v <= 1 && v > 0 ? asPercent(v) : formatValue(v)}
//                                 </span>
//                               </div>
//                             ))}
//                           </div>
//                           {reflection.reason && <pre className="evidence-finding-pre">{reflection.reason}</pre>}
//                         </div>
//                       )}

//                       <div className="metadata-card" style={{ marginTop: '12px' }}>
//                         <div
//                           className="metadata-card-header raw-json-toggle"
//                           onClick={() => setShowRawJson(v => !v)}
//                         >
//                           RAW BACKEND RESPONSE <span>{showRawJson ? '▲' : '▼'}</span>
//                         </div>
//                         {showRawJson && (
//                           <pre className="raw-json-pre">
//                             {rawBackendResponse
//                               ? JSON.stringify(rawBackendResponse, null, 2)
//                               : "No backend response received yet."}
//                           </pre>
//                         )}
//                       </div>
//                     </div>
//                   )}

//                   {activeResultTab === 'evidence' && (
//                     <div className="evidence-tab-container">
//                       {evidenceItems.length === 0 && (
//                         <div className="empty-note">No evidence returned by the backend.</div>
//                       )}

//                       {evidenceItems.map((ev, idx) => {
//                         const art = artifactForEvidence(ev);
//                         const cs = ev?.change_stats || null;
//                         const okStatus = String(ev?.status || '').toLowerCase() === 'ok';
//                         return (
//                           <div className="evidence-detail-card" key={ev?.evidence_id || idx}>
//                             <div className="evidence-detail-head">
//                               <div>
//                                 <div className="evidence-card-title">{toTitle(ev?.agent) || `Evidence ${idx + 1}`}</div>
//                                 <div className="evidence-sub">{ev?.evidence_id} · {toTitle(ev?.task)}</div>
//                               </div>
//                               <span className={okStatus ? 'status-pill-green' : 'status-pill-amber'}>
//                                 {(ev?.status || 'unknown').toUpperCase()}
//                               </span>
//                             </div>

//                             {art?.image_b64 && (
//                               <img className="evidence-artifact-img" src={art.image_b64} alt={art.artifact_id || 'artifact'} />
//                             )}

//                             <div className="evidence-stats-grid">
//                               <div className="evidence-stat-col">
//                                 <span className="evidence-stat-label">Confidence</span>
//                                 <span className="evidence-stat-value">{asPercent(ev?.confidence)}</span>
//                               </div>
//                               <div className="evidence-stat-col">
//                                 <span className="evidence-stat-label">Task</span>
//                                 <span className="evidence-stat-value">{toTitle(ev?.task) || '—'}</span>
//                               </div>
//                               <div className="evidence-stat-col">
//                                 <span className="evidence-stat-label">Visual Evidence</span>
//                                 <span className="evidence-stat-value">{formatValue(ev?.visual_evidence)}</span>
//                               </div>
//                               <div className="evidence-stat-col">
//                                 <span className="evidence-stat-label">Boxes</span>
//                                 <span className="evidence-stat-value">
//                                   {Array.isArray(ev?.boxes) ? ev.boxes.length : (ev?.boxes == null ? 'None' : formatValue(ev.boxes))}
//                                 </span>
//                               </div>
//                             </div>

//                             {cs && (
//                               <div className="change-stats-grid" style={{ marginTop: '10px' }}>
//                                 <KV label="Changed Fraction" value={asPercent(cs.changed_fraction)} />
//                                 <KV label="Method" value={toTitle(cs.method)} />
//                                 <KV label="Threshold" value={formatValue(cs.threshold)} />
//                                 <KV label="Change BBox" value={Array.isArray(cs.change_bbox) ? cs.change_bbox.map(n => Number(n).toFixed(3)).join(', ') : '—'} />
//                               </div>
//                             )}

//                             {ev?.verified_finding && (
//                               <div className="finding-block">
//                                 <span className="finding-label">Verified Finding</span>
//                                 <pre className="evidence-finding-pre">{ev.verified_finding}</pre>
//                               </div>
//                             )}
//                             {ev?.finding && (
//                               <div className="finding-block">
//                                 <span className="finding-label">Raw Finding</span>
//                                 <pre className="evidence-finding-pre">{ev.finding}</pre>
//                               </div>
//                             )}
//                           </div>
//                         );
//                       })}
//                     </div>
//                   )}

//                   {activeResultTab === 'layers' && (
//                     <div className="layers-tab-container">
//                       {artifacts.length === 0 && (
//                         <div className="empty-note">No artifacts returned by the backend.</div>
//                       )}
//                       {artifacts.map((art, idx) => (
//                         <div className="artifact-card" key={art?.artifact_id || idx}>
//                           <div className="artifact-head">
//                             <span className="layer-title-text">{toTitle(art?.kind) || 'Artifact'}</span>
//                             <span className="layer-desc-text">{art?.artifact_id}</span>
//                           </div>
//                           {art?.image_b64 && (
//                             <img className="artifact-img" src={art.image_b64} alt={art.artifact_id || 'artifact'} />
//                           )}
//                           <div className="change-stats-grid">
//                             <KV label="Kind" value={toTitle(art?.kind)} />
//                             <KV label="Produced By" value={toTitle(art?.produced_by)} />
//                           </div>
//                         </div>
//                       ))}

//                       {evidenceItems.some(e => e?.visual_evidence?.length) && (
//                         <div className="artifact-card">
//                           <div className="artifact-head">
//                             <span className="layer-title-text">Visual Evidence References</span>
//                           </div>
//                           <div className="chip-row">
//                             {[...new Set(evidenceItems.flatMap(e => e?.visual_evidence || []))].map((v, i) => (
//                               <span className="ve-chip" key={i}>{v}</span>
//                             ))}
//                           </div>
//                         </div>
//                       )}
//                     </div>
//                   )}
//                 </div>
//               ) : (
//                 <div className="sp-analysis-card">
//                   <div className="analysis-header">
//                     <span className="agent-title">SATQUERY AGENT <span className="agent-status">- ACTIVE</span></span>
//                     <h2>Analyzing Earth Observation Data</h2>
//                   </div>

//                   <div className="analysis-image" style={{ backgroundImage: sentFiles.length > 0 ? `url('${sentFiles[0].preview}')` : "url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80')" }}>
//                     <div className="image-badges">
//                       <span className="badge dark">SENTINEL 2</span>
//                       <span className="badge dark">OPTICAL</span>
//                       <span className="badge dark">10m</span>
//                     </div>
//                   </div>

//                   <div className="analysis-details">
//                     <div className="compatibility-check">
//                       <h3>Compatibility Check</h3>
//                       <div className="comp-card">
//                         <div className="comp-card-header">
//                           <div className="comp-thumb" style={{ backgroundImage: sentFiles.length > 0 ? `url('${sentFiles[0].preview}')` : "url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=200&q=80')" }}></div>
//                           <div className="comp-title">
//                             <strong>{sentFiles.length > 0 ? sentFiles[0].name : 'satellite_image.tif'}</strong>
//                             <span>14.2 MB - Uploaded 2014-02-23</span>
//                           </div>
//                           <div className="comp-status">✓ COMPATIBLE</div>
//                         </div>
//                         <div className="comp-stats">
//                           <div className="stat-col">
//                             <span className="stat-label">FORMAT</span>
//                             <span className="stat-val">GeoTIFF</span>
//                           </div>
//                           <div className="stat-col">
//                             <span className="stat-label">MODALITY</span>
//                             <span className="stat-val">Optical</span>
//                           </div>
//                           <div className="stat-col">
//                             <span className="stat-label">RESOLUTION</span>
//                             <span className="stat-val">10 m</span>
//                           </div>
//                           <div className="stat-col">
//                             <span className="stat-label">CRS</span>
//                             <span className="stat-val">EPSG:4326</span>
//                           </div>
//                           <div className="stat-col">
//                             <span className="stat-label">ACQUISITION</span>
//                             <span className="stat-val">12 Aug 2026</span>
//                           </div>
//                           <div className="stat-col">
//                             <span className="stat-label">BANDS</span>
//                             <span className="stat-val">13 (Sentinel-2)</span>
//                           </div>
//                         </div>
//                       </div>
//                     </div>

//                     <div className="execution-timeline">
//                       <h3>EXECUTION TIMELINE</h3>
//                       <ul className="timeline-list">
//                         {[
//                           "Input validated",
//                           "Query understood",
//                           "Task identified",
//                           "Specialist selected",
//                           "Running analysis",
//                           "Generating evidence",
//                           "Preparing response"
//                         ].map((stepLabel, idx) => {
//                           let stepClass = "pending";
//                           if (idx < timelineStep) stepClass = "done";
//                           else if (idx === timelineStep) stepClass = "active";

//                           return (
//                             <li key={idx} className={stepClass}>
//                               {stepLabel}
//                               {stepClass === "active" && <span className="processing-text">PROCESSING...</span>}
//                             </li>
//                           );
//                         })}
//                       </ul>
//                     </div>
//                   </div>
//                 </div>
//               )}
//             </div>
//           </div>
//         )}
//       </div>

//       {isDashboardPanelOpen && (
//         <div className="dashboard-panel-layer" role="dialog" aria-modal="true" aria-label="Dashboard">
//           <button
//             className="dashboard-panel-backdrop"
//             aria-label="Close dashboard"
//             onClick={() => setIsDashboardPanelOpen(false)}
//           />
//           <aside className="dashboard-panel">
//             <button
//               className="dashboard-panel-close"
//               aria-label="Close dashboard"
//               onClick={() => setIsDashboardPanelOpen(false)}
//             >
//               ×
//             </button>
//             <Dashboard
//               initialTab="dashboard"
//               onNewAnalysis={handleNewAnalysis}
//             />
//           </aside>
//         </div>
//       )}
//     </div>
//   );
// }


//new code


import React, { useState, useRef, useEffect } from 'react';
import { socket } from '../socket/socket';
import { DEFAULT_USER_ID, SOCKET_KEY } from '../config/api';
import Dashboard from './Dashboard';
import MapSelectModal from './MapSelectModal';
import './SearchPage.css';

function KV({ label, value }) {
  return (
    <div className="kv-item">
      <span className="kv-label">{label}</span>
      <span className="kv-value">{value}</span>
    </div>
  );
}

export default function SearchPage({
  onNavigate,
  isLoggedIn = false,
  user = null,
  onLogin,
  onSignup,
  onLogout
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDashboardPanelOpen, setIsDashboardPanelOpen] = useState(false);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [mapRegion, setMapRegion] = useState(null); // { bbox: [min_lon, min_lat, max_lon, max_lat] }
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalFeature, setAuthModalFeature] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploadError, setUploadError] = useState('');
  const [hasQueried, setHasQueried] = useState(false);
  const [queryText, setQueryText] = useState("");
  const [rawBackendResponse, setRawBackendResponse] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const conversationIdRef = useRef(conversationId);
  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);
  const [mlSessionId, setMlSessionId] = useState(null);
  const [mlStatusPayload, setMlStatusPayload] = useState(null);
  const [mlStatusHistory, setMlStatusHistory] = useState([]);
  const currentUserId = user?.id || user?.data?.id || (user && typeof user === 'object' && user.id) || DEFAULT_USER_ID;
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeResultTab, setActiveResultTab] = useState('overview');
  const [showEvidence, setShowEvidence] = useState(true);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [timelineStep, setTimelineStep] = useState(0);
  const [latestAiAnswer, setLatestAiAnswer] = useState("");
  const [evidenceList, setEvidenceList] = useState([]);
  const [openTraceSteps, setOpenTraceSteps] = useState({});
  const [executionTrace, setExecutionTrace] = useState([]);
  const [durationSeconds, setDurationSeconds] = useState(null);
  const [backendResult, setBackendResult] = useState(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [overviewImageMode, setOverviewImageMode] = useState('change');
  const [inputValue, setInputValue] = useState('');
  const [sentFiles, setSentFiles] = useState([]);
  const [processingNodes, setProcessingNodes] = useState([]);
  const fileInputRef = useRef(null);

  const handleNewAnalysis = () => {
    setHasQueried(false);
    setMessages([]);
    setQueryText('');
    setInputValue('');
    setUploadedFiles([]);
    setMapRegion(null);
    setSentFiles([]);
    setConversationId(null);
    setMlSessionId(null);
    setMlStatusPayload(null);
    setMlStatusHistory([]);
    setAnalysisComplete(false);
    setIsLoading(false);
    setBackendResult(null);
    setEvidenceList([]);
    setExecutionTrace([]);
    setLatestAiAnswer('');
    setUploadError('');
    setIsSidebarOpen(false);
    setIsDashboardPanelOpen(false);
    setProcessingNodes([]);
  };

  const handleProtectedNavigate = (target) => {
    if (!isLoggedIn) {
      setAuthModalFeature(target);
      setShowAuthModal(true);
      return;
    }
    if (onNavigate) onNavigate(target);
  };

  const isStepOpen = (i) => openTraceSteps[i] !== false;

  const toggleTraceStep = (step) => {
    setOpenTraceSteps(prev => ({ ...prev, [step]: prev[step] === false ? true : false }));
  };

  const toggleAllTraceSteps = (count) => {
    const anyOpen = Array.from({ length: count }).some((_, i) => isStepOpen(i));
    const next = {};
    for (let i = 0; i < count; i++) next[i] = !anyOpen;
    setOpenTraceSteps(next);
  };

  const renderStructuredText = (text) => {
    if (!text || typeof text !== 'string') return text;
    if (text.startsWith('⚠️')) {
      return <span>{text}</span>;
    }

    const segments = text
      .split(/(?:\.\s+(?=\*\*)|(?<=\))\s+(?=\*\*)|(?:\n+)|(?:-\s+))/g)
      .map(s => s.trim())
      .filter(Boolean);

    if (segments.length <= 1) {
      return (
        <span dangerouslySetInnerHTML={{
          __html: text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        }} />
      );
    }

    return (
      <div className="structured-ai-response">
        {segments.map((seg, i) => {
          const isHighlight = seg.toLowerCase().includes('absence') || seg.toLowerCase().includes('note') || seg.toLowerCase().includes('does not guarantee');
          const html = seg.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
          if (isHighlight) {
            return (
              <div key={i} className="response-highlight-box" dangerouslySetInnerHTML={{ __html: html }} />
            );
          }
          return (
            <div key={i} className="response-segment">
              <span style={{ color: '#00B4D8', fontSize: '14px', lineHeight: '1.2' }}>•</span>
              <span dangerouslySetInnerHTML={{ __html: html }} />
            </div>
          );
        })}
      </div>
    );
  };

  const toTitle = (s) => (s === null || s === undefined ? '' : String(s))
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const asPercent = (n) => {
    if (n === null || n === undefined || n === '') return '—';
    const num = typeof n === 'string' ? parseFloat(n) : n;
    if (Number.isNaN(num)) return String(n);
    return `${Math.round(num <= 1 ? num * 100 : num)}%`;
  };

  const formatValue = (v) => {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    if (Array.isArray(v)) return v.length ? v.map(formatValue).join(', ') : '—';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  };

  const handleExportJson = () => {
    const metadata = backendResult || {};

    const detailedJson = {
      report_version: "1.0",

      generated_at: new Date().toISOString(),

      conversation: {
        conversation_id:
          rawBackendResponse?.conversationId ||
          conversationId ||
          null,

        user_id: userId,

        query:
          rawBackendResponse?.userMessage?.content ||
          metadata.query ||
          queryText ||
          null
      },

      analysis: {
        current_task: metadata.current_task || null,
        temporal_mode: metadata.temporal_mode || null,
        image_count: metadata.image_count ?? null,
        modalities: metadata.modalities || [],
        input_valid: metadata.input_valid ?? null,
        validation_errors: metadata.validation_errors || [],
        confidence: metadata.confidence ?? null,
        duration_seconds: metadata.duration_seconds ?? null,
        retry_count: metadata.retry_count ?? 0
      },

      answer: {
        final_answer:
          rawBackendResponse?.assistantMessage?.content ||
          metadata.final_answer ||
          latestAiAnswer ||
          null,

        role:
          rawBackendResponse?.assistantMessage?.role ||
          "ASSISTANT",

        decision:
          metadata.reflection?.decision ||
          null
      },

      evidence: Array.isArray(metadata.evidence)
        ? metadata.evidence
        : [],

      execution_trace: Array.isArray(metadata.execution_trace)
        ? metadata.execution_trace.map((step, index) => ({
          step: index + 1,
          ...step
        }))
        : [],

      reflection: metadata.reflection || null,

      artifacts: Array.isArray(metadata.artifacts)
        ? metadata.artifacts
        : [],

      source: {
        assistant_message:
          rawBackendResponse?.assistantMessage || null,

        user_message:
          rawBackendResponse?.userMessage || null
      }
    };

    const blob = new Blob(
      [JSON.stringify(detailedJson, null, 2)],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `satquery_detailed_analysis_${Date.now()}.json`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  };

  const handleDownloadReport = () => {
    const r = backendResult || {};

    const answer = r.final_answer || latestAiAnswer || "-";

    const confidence =
      r.confidence != null
        ? `${Math.round(
          r.confidence <= 1 ? r.confidence * 100 : r.confidence
        )}%`
        : "N/A";

    const reflectionConfidence =
      r.reflection?.confidence != null
        ? `${Math.round(
          r.reflection.confidence <= 1
            ? r.reflection.confidence * 100
            : r.reflection.confidence
        )}%`
        : "N/A";

    const evidenceConfidence =
      r.reflection?.evidence_confidence != null
        ? `${Math.round(
          r.reflection.evidence_confidence <= 1
            ? r.reflection.evidence_confidence * 100
            : r.reflection.evidence_confidence
        )}%`
        : "N/A";

    const minConfidence =
      r.reflection?.min_confidence != null
        ? `${Math.round(
          r.reflection.min_confidence <= 1
            ? r.reflection.min_confidence * 100
            : r.reflection.min_confidence
        )}%`
        : "N/A";

    // --------------------------------------------------
    // EVIDENCE
    // --------------------------------------------------

    const evidenceReport = Array.isArray(r.evidence)
      ? r.evidence.map((e, index) => {
        const stats = e.change_stats || {};

        const changedFraction =
          stats.changed_fraction != null
            ? `${(stats.changed_fraction * 100).toFixed(2)}%`
            : "N/A";

        const bbox = Array.isArray(stats.change_bbox)
          ? stats.change_bbox
            .map(v => Number(v).toFixed(4))
            .join(", ")
          : "N/A";

        const visualEvidence =
          Array.isArray(e.visual_evidence)
            ? e.visual_evidence.join(", ")
            : "None";

        return `
------------------------------------------------------------
EVIDENCE ${index + 1}
------------------------------------------------------------

Evidence ID       : ${e.evidence_id || "N/A"}
Agent             : ${e.agent || "N/A"}
Task              : ${e.task || "N/A"}
Status            : ${e.status || "N/A"}
Confidence        : ${e.confidence != null
            ? `${Math.round(
              e.confidence <= 1
                ? e.confidence * 100
                : e.confidence
            )}%`
            : "N/A"
          }

Visual Evidence
------------------------------------------------------------
${visualEvidence}

RAW FINDING
------------------------------------------------------------
${e.finding || "N/A"}

VERIFIED FINDING
------------------------------------------------------------
${e.verified_finding || "N/A"}

CHANGE STATISTICS
------------------------------------------------------------
Changed Fraction  : ${changedFraction}
Method            : ${stats.method || "N/A"}
Threshold         : ${stats.threshold ?? "N/A"}
Change BBox       : ${bbox}

Boxes
------------------------------------------------------------
${Array.isArray(e.boxes)
            ? JSON.stringify(e.boxes, null, 2)
            : "None"
          }
`;
      }).join("\n")
      : "No evidence returned.";

    // --------------------------------------------------
    // EXECUTION TRACE
    // --------------------------------------------------

    const traceReport = Array.isArray(r.execution_trace)
      ? r.execution_trace.map((step, index) => {

        const details = Object.entries(step || {})
          .filter(([key]) => key !== "node" && key !== "status")
          .map(
            ([key, value]) =>
              `    ${toTitle(key)} : ${formatValue(value)}`
          )
          .join("\n");

        return `
${String(index + 1).padStart(2, "0")}. ${toTitle(step.node) || "Unknown Node"}
    Status : ${(step.status || "unknown").toUpperCase()}
${details || "    No additional metadata"}
`;
      }).join("\n")
      : "No execution trace returned.";

    // --------------------------------------------------
    // ARTIFACTS
    // --------------------------------------------------

    const artifactReport = Array.isArray(r.artifacts)
      ? r.artifacts.map((artifact, index) => `
------------------------------------------------------------
ARTIFACT ${index + 1}
------------------------------------------------------------

Artifact ID       : ${artifact.artifact_id || "N/A"}
Kind              : ${artifact.kind || "N/A"}
Produced By       : ${artifact.produced_by || "N/A"}
Image Available   : ${artifact.image_b64 ? "YES" : "NO"}
`).join("\n")
      : "No artifacts returned.";

    // --------------------------------------------------
    // REFLECTION
    // --------------------------------------------------

    const reflectionReport = r.reflection
      ? `
Decision           : ${r.reflection.decision || "N/A"}
Required Action    : ${r.reflection.required_action || "N/A"}
Confidence         : ${reflectionConfidence}
Evidence Confidence: ${evidenceConfidence}
Minimum Confidence : ${minConfidence}
Retry Count        : ${r.reflection.retry_count ?? 0}

Reason
------------------------------------------------------------
${r.reflection.reason || "N/A"}
`
      : "No reflection information returned.";

    // --------------------------------------------------
    // VALIDATION
    // --------------------------------------------------

    const validationErrors =
      Array.isArray(r.validation_errors) &&
        r.validation_errors.length > 0
        ? r.validation_errors
          .map(error => `• ${error}`)
          .join("\n")
        : "None";

    // --------------------------------------------------
    // COMPLETE REPORT
    // --------------------------------------------------

    const reportText = `
============================================================
                      SATQUERY AI
             EARTH OBSERVATION ANALYSIS
                       REPORT
============================================================

REPORT INFORMATION
============================================================

Report Version      : 1.0
Generated At        : ${new Date().toLocaleString()}
Conversation ID     : ${conversationId || "N/A"}
User ID             : ${userId || "N/A"}


QUERY
============================================================

${r.query || queryText || "N/A"}


ANALYSIS SUMMARY
============================================================

Current Task        : ${toTitle(r.current_task) || "N/A"}
Temporal Mode       : ${toTitle(r.temporal_mode) || "N/A"}
Image Count         : ${r.image_count ?? "N/A"}
Modalities          : ${formatValue(r.modalities)}
Input Valid         : ${formatValue(r.input_valid)}
Retry Count         : ${r.retry_count ?? 0}
Duration            : ${r.duration_seconds != null
        ? `${Number(r.duration_seconds).toFixed(3)} seconds`
        : "N/A"
      }


CONFIDENCE
============================================================

Answer Confidence   : ${confidence}
Reflection          : ${reflectionConfidence}
Evidence Confidence : ${evidenceConfidence}
Minimum Threshold   : ${minConfidence}


VALIDATION
============================================================

Input Valid         : ${r.input_valid ? "YES" : "NO"}

Validation Errors:
${validationErrors}


DECISION
============================================================

Decision            : ${r.reflection?.decision || "N/A"}
Required Action     : ${r.reflection?.required_action || "N/A"}


FINAL ANSWER
============================================================

${answer}


EVIDENCE
============================================================

${evidenceReport}


EXECUTION TRACE
============================================================

${traceReport}


REFLECTION
============================================================

${reflectionReport}


ARTIFACTS
============================================================

${artifactReport}


CHANGE DETECTION SUMMARY
============================================================

${r.evidence?.[0]?.change_stats
        ? `
Changed Fraction    : ${r.evidence[0].change_stats.changed_fraction != null
          ? `${(
            r.evidence[0].change_stats.changed_fraction * 100
          ).toFixed(2)}%`
          : "N/A"
        }

Method              : ${r.evidence[0].change_stats.method || "N/A"
        }

Threshold           : ${r.evidence[0].change_stats.threshold ?? "N/A"
        }

Change Bounding Box : ${Array.isArray(r.evidence[0].change_stats.change_bbox)
          ? r.evidence[0].change_stats.change_bbox.join(", ")
          : "N/A"
        }
`
        : "No change statistics available."
      }


============================================================
                    END OF REPORT
============================================================
`;

    // --------------------------------------------------
    // DOWNLOAD
    // --------------------------------------------------

    const blob = new Blob(
      [reportText],
      {
        type: "text/plain;charset=utf-8"
      }
    );

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;

    a.download =
      `satquery_analysis_report_${Date.now()}.txt`;

    document.body.appendChild(a);

    a.click();

    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  };

  const extractMessageText = (item) => {
    if (!item) return "";
    if (typeof item === "string") return item;
    if (item.content) {
      if (typeof item.content === "string") return item.content;
      if (item.content.content && typeof item.content.content === "string") {
        return item.content.content;
      }
    }
    if (item.message && typeof item.message === "string") return item.message;
    return "";
  };

  useEffect(() => {
    if (!isLoading || analysisComplete) return;

    const interval = setInterval(() => {
      setTimelineStep(prev => (prev < 6 ? prev + 1 : 6));
    }, 450);

    return () => clearInterval(interval);
  }, [isLoading, analysisComplete]);

  useEffect(() => {
    socket.connect();

    socket.on("connect", () => {
      console.log("Socket connected:", socket.id);
    });

    socket.on("message:status", (data) => {
      console.log("📡 ML STATUS UPDATE:", data);
      const { conversationId: statusConvId, event, data: payload } = data || {};

      if (statusConvId && (!conversationIdRef.current || conversationIdRef.current.startsWith('conv_local_'))) {
        setConversationId(statusConvId);
      }

      if (event === "start") {
        console.log("🚀 ML Processing Started. Session ID:", payload?.session_id);
        if (payload?.session_id) {
          setMlSessionId(payload.session_id);
        }
        setMlStatusHistory(prev => {
          if (prev.some(item => item.id === 'start')) return prev;
          return [
            ...prev,
            { id: 'start', node: 'start', title: 'ML Pipeline Initialized', desc: `Session: ${payload?.session_id || 'active'}`, status: 'COMPLETED' }
          ];
        });
        setTimelineStep(prev => Math.max(prev, 1));
      }

      if (event === "progress") {
        const rawNode = payload?.node || "processing";
        const rawStatus = payload?.status || "processing";
        const node = String(rawNode).toLowerCase();
        const status = String(rawStatus).toUpperCase();
        console.log(`📡 Node: ${node} → Status: ${status}`);
        setMlStatusPayload(payload);

        setMlStatusHistory(prev => {
          const existingIndex = prev.findIndex(item => item.node === rawNode);
          const newItem = {
            id: `node_${rawNode}`,
            node: rawNode,
            title: `Node: ${String(rawNode).toUpperCase()}`,
            status: status,
            target: payload?.target,
            attempt: payload?.attempt,
            confidence: payload?.confidence
          };
          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = newItem;
            return updated;
          }
          return [...prev, newItem];
        });

        if (node.includes("grounding") || node.includes("query") || node.includes("input")) {
          setTimelineStep(prev => Math.max(prev, 2));
        } else if (node.includes("task") || node.includes("specialist")) {
          setTimelineStep(prev => Math.max(prev, 3));
        } else if (node.includes("analysis") || node.includes("verification")) {
          setTimelineStep(prev => Math.max(prev, 4));
        } else if (node.includes("evidence")) {
          setTimelineStep(prev => Math.max(prev, 5));
        } else if (node.includes("response") || node.includes("final")) {
          setTimelineStep(prev => Math.max(prev, 6));
        }
      }
    });

    socket.on("message:response", (data) => {
      console.log("AI RESPONSE:", data);
      setRawBackendResponse(data);
      setTimelineStep(6);

      if (data?.conversationId) {
        setConversationId(data.conversationId);
      }

      let aiText = "";
      if (data?.assistantMessage) {
        aiText = extractMessageText(data.assistantMessage);
      } else if (data?.message) {
        aiText = extractMessageText(data.message);
      }

      const hasResultShape = (o) => o && typeof o === 'object' && (
        o.final_answer !== undefined || o.execution_trace !== undefined ||
        o.evidence !== undefined || o.reflection !== undefined
      );

      const backendMeta =
        (hasResultShape(data?.assistantMessage?.metadata) && data.assistantMessage.metadata) ||
        (hasResultShape(data?.assistantMessage?.content?.metadata) && data.assistantMessage.content.metadata) ||
        (hasResultShape(data?.metadata) && data.metadata) ||
        (hasResultShape(data?.result) && data.result) ||
        (hasResultShape(data) && data) ||
        data?.assistantMessage?.metadata ||
        data?.assistantMessage?.content?.metadata ||
        data?.metadata ||
        null;

      if (backendMeta && typeof backendMeta === 'object') {
        setBackendResult(backendMeta);
        setOpenTraceSteps({});
        setOverviewImageMode('change');
      }

      const backendEvidence = backendMeta?.evidence;
      if (backendEvidence && Array.isArray(backendEvidence)) {
        setEvidenceList(backendEvidence);
      }
      if (backendMeta?.execution_trace && Array.isArray(backendMeta.execution_trace)) {
        setExecutionTrace(backendMeta.execution_trace);
      }
      if (backendMeta?.duration_seconds) {
        setDurationSeconds(backendMeta.duration_seconds);
      }

      const finalText = aiText || backendMeta?.final_answer || "";
      if (finalText) {
        setLatestAiAnswer(finalText);
        setMessages(prev => [...prev, { role: 'assistant', content: finalText }]);
      }

      setIsLoading(false);
      setAnalysisComplete(true);

      const activeConvId = data?.conversationId || conversationIdRef.current;
      try {
        const existing = JSON.parse(localStorage.getItem('satquery_local_history') || '[]');
        if (existing.length > 0) {
          const targetIndex = activeConvId
            ? existing.findIndex(c => c.id === activeConvId)
            : 0;

          if (targetIndex >= 0 && targetIndex < existing.length) {
            const item = existing[targetIndex];
            const confVal = backendMeta?.confidence != null
              ? `${Math.round(backendMeta.confidence <= 1 ? backendMeta.confidence * 100 : backendMeta.confidence)}%`
              : (item.confidence || '85%');

            item.status = 'COMPLETE';
            item.confidence = confVal;
            if (backendMeta?.temporal_mode) {
              item.mode = backendMeta.image_count > 1 ? 'Bi-Temporal' : 'Single Image';
            }

            const hasAssistantMsg = item.rawMessages?.some(m => m.role === 'ASSISTANT');
            if (!hasAssistantMsg && finalText) {
              if (!item.rawMessages) item.rawMessages = [];
              item.rawMessages.push({
                id: `msg_ai_${Date.now()}`,
                role: 'ASSISTANT',
                content: finalText,
                createdAt: new Date().toISOString(),
                metadata: backendMeta || {}
              });
            }
            localStorage.setItem('satquery_local_history', JSON.stringify(existing));
          }
        }
      } catch (err) {
        console.error('Error updating local history:', err);
      }
    });

    socket.on("message:error", (error) => {
      console.log("❌ BACKEND ERROR:", error);
      setIsLoading(false);
      setAnalysisComplete(true);
      setTimelineStep(0);
      let cleanMsg = (typeof error === 'object' && error?.message)
        ? error.message
        : (typeof error === 'string' ? error : "An error occurred while communicating with the backend.");

      if (typeof cleanMsg === 'string' && cleanMsg.toLowerCase().includes("conversation not found")) {
        setConversationId(null);
      }

      if (typeof cleanMsg === 'string' && (cleanMsg.includes('<!DOCTYPE') || cleanMsg.includes('<html'))) {
        if (cleanMsg.includes('ERR_NGROK') || cleanMsg.includes('ngrok')) {
          cleanMsg = "ML API failed: The ML model server (ngrok tunnel 'respect-tigress-retorted.ngrok-free.dev') is offline.";
        } else {
          cleanMsg = "ML API failed: Server returned a 404 HTML error response.";
        }
      }

      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ Backend Notice: ${cleanMsg}` }]);
    });

    socket.on("connect_error", (error) => {
      console.error("❌ Socket connection error:", error.message);
    });

    return () => {
      socket.off("connect");
      socket.off("message:status");
      socket.off("message:response");
      socket.off("message:error");
      socket.off("connect_error");
      socket.disconnect();
    };
  }, []);

  const handleFileUpload = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);
      const availableSlots = 2 - uploadedFiles.length;

      if (availableSlots <= 0) {
        setUploadError('You can upload a maximum of 2 images.');
        e.target.value = '';
        return;
      }

      const imageFiles = selectedFiles.filter(file => file.type.startsWith('image/'));
      const newFiles = imageFiles.slice(0, availableSlots).map(f => ({
        name: f.name,
        preview: URL.createObjectURL(f),
        file: f,
      }));

      if (imageFiles.length !== selectedFiles.length) {
        setUploadError('Only image files can be uploaded.');
      } else if (selectedFiles.length > availableSlots) {
        setUploadError('You can upload a maximum of 2 images.');
      } else {
        setUploadError('');
      }

      setUploadedFiles(prev => [...prev, ...newFiles]);
      setIsPopupOpen(false);
      e.target.value = '';
    }
  };

  const handleDriveUpload = () => {
    if (uploadedFiles.length >= 2) {
      setUploadError('You can upload a maximum of 2 images.');
      return;
    }

    setUploadedFiles(prev => [...prev, {
      name: "Drive_Image_Selected.tif",
      preview: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=200&q=80",
      file: null,
    }]);
    setUploadError('');
    setIsPopupOpen(false);
  };

  const removeFile = (index) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    setUploadError('');
  };

  const removeMapRegion = () => {
    setMapRegion(null);
  };

  const handleMapRegionConfirm = (bbox) => {
    setMapRegion({ bbox });
    setIsMapModalOpen(false);
    setUploadError('');
  };

  const handleSend = async () => {
    const currentQuery = inputValue.trim();
    if (uploadedFiles.length === 0 && !mapRegion) {
      setUploadError('Please upload a satellite image or select a region on the map to start analysis.');
      return;
    }

    const currentFiles = [...uploadedFiles];
    const currentRegion = mapRegion;
    const isLocalId = !conversationId || conversationId.startsWith('conv_local_');
    const newConvId = isLocalId ? `conv_local_${Date.now()}` : conversationId;

    setUploadError('');
    setQueryText(currentQuery);
    setSentFiles(currentFiles);
    setHasQueried(true);
    setIsLoading(true);
    setAnalysisComplete(false);
    setTimelineStep(0);
    setActiveResultTab('overview');
    setMlSessionId(null);
    setMlStatusPayload(null);
    setMlStatusHistory([]);

    const imagesBase64 = [];
    const imagesDataUrls = [];

    for (const uploadedFile of currentFiles) {
      const file = uploadedFile.file;

      if (!file) {
        if (uploadedFile.preview) imagesDataUrls.push(uploadedFile.preview);
        continue;
      }

      try {
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        imagesDataUrls.push(dataUrl);
        const base64Str = dataUrl.split(',')[1];
        if (base64Str) imagesBase64.push(base64Str);
      } catch (err) {
        console.error("❌ Failed to convert image:", err);
      }
    }

    // Create local history entry with persistent Data URLs
    try {
      const newHistoryItem = {
        id: newConvId,
        userId: currentUserId,
        title: currentQuery || 'Satellite image analysis',
        date: new Date().toISOString(),
        mode: currentFiles.length > 1 ? 'Bi-Temporal' : (currentFiles.length === 1 ? 'Single Image' : 'Single Image'),
        confidence: null,
        status: 'PENDING',
        bbox: currentRegion?.bbox || null,
        rawMessages: [
          {
            id: `msg_user_${Date.now()}`,
            role: 'USER',
            content: currentQuery || 'Analyze uploaded satellite image',
            createdAt: new Date().toISOString(),
            images: imagesDataUrls.length > 0 ? imagesDataUrls : currentFiles.map(f => f.preview)
          }
        ]
      };

      const existing = JSON.parse(localStorage.getItem('satquery_local_history') || '[]');
      const filtered = existing.filter(c => c.id !== newConvId);
      filtered.unshift(newHistoryItem);
      localStorage.setItem('satquery_local_history', JSON.stringify(filtered));
    } catch (err) {
      console.error('Error saving local history entry:', err);
    }

    const payload = {
      key: SOCKET_KEY,
      userId: currentUserId,
      message: currentQuery,
      images: imagesBase64,
    };

    if (currentRegion?.bbox) {
      payload.bbox = currentRegion.bbox;
    }

    if (conversationId && !conversationId.startsWith('conv_local_')) {
      payload.conversationId = conversationId;
    }

    socket.emit("message:send", payload);

    setInputValue('');
    setUploadedFiles([]);
    setMapRegion(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  // ---- Backend result (ar.txt shape) derived views ----
  const R = backendResult || {};
  const evidenceItems = (Array.isArray(R.evidence) && R.evidence.length) ? R.evidence : evidenceList;
  const traceSteps = (Array.isArray(R.execution_trace) && R.execution_trace.length) ? R.execution_trace : executionTrace;
  const artifacts = Array.isArray(R.artifacts) ? R.artifacts : [];
  const reflection = R.reflection || null;
  const totalDuration = R.duration_seconds ?? durationSeconds;
  const changeMapArtifact = artifacts.find(a => a && a.image_b64) || null;
  const artifactForEvidence = (ev) =>
    artifacts.find(a => ev?.evidence_id && a?.artifact_id && a.artifact_id.startsWith(ev.evidence_id)) || null;
  const overallConfidence = R.confidence ?? evidenceItems?.[0]?.confidence;
  const primaryEvidence = evidenceItems?.[0] || null;
  const changeStats = primaryEvidence?.change_stats || null;
  const sourcePreview = sentFiles.length > 0 ? sentFiles[0].preview : null;
  const showChangeMap = overviewImageMode === 'change' && !!changeMapArtifact;
  const overviewImage = showChangeMap
    ? changeMapArtifact.image_b64
    : (sourcePreview || 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80');
  const bbox = Array.isArray(changeStats?.change_bbox) && changeStats.change_bbox.length === 4
    ? changeStats.change_bbox : null;

  const hasAttachment = uploadedFiles.length > 0 || !!mapRegion;

  const searchBarElement = (
        <div className="search-bar-wrapper">
          <div className={`search-bar ${hasAttachment ? 'has-files' : ''}`}>
            
            {hasAttachment && (
              <div className="uploaded-files-preview">
                {uploadedFiles.map((file, i) => (
                  <div className="file-preview-card" key={i}>
                    <div className="remove-file-badge" onClick={() => removeFile(i)}>×</div>
                    <div className="file-thumbnail" style={{ backgroundImage: `url('${file.preview}')` }}></div>
                  </div>
                ))}
                {mapRegion && (
                  <div className="file-preview-card region-preview-card">
                    <div className="remove-file-badge" onClick={removeMapRegion}>×</div>
                    <div className="region-thumbnail">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 20l-5.447-2.724A1 1 0 0 1 3 16.382V5.618a1 1 0 0 1 1.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0 0 21 18.382V7.618a1 1 0 0 0-.553-.894L15 4m0 13V4m0 0L9 7"></path>
                      </svg>
                      <span>Region</span>
                    </div>
                  </div>
                )}
              </div>
            )}

        <div className="search-input-row">
          <div
            className={`search-plus-icon ${isPopupOpen ? 'open' : ''}`}
            onClick={() => setIsPopupOpen(!isPopupOpen)}
          >
            {isPopupOpen ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            )}
          </div>

          {isPopupOpen && (
            <div className="search-popup-menu">
              <div className="popup-item" onClick={() => fileInputRef.current.click()}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                Upload files
              </div>
              <div className="popup-item" onClick={handleDriveUpload}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>
                Add from Drive
              </div>
              <div
                className="popup-item"
                onClick={() => {
                  setIsPopupOpen(false);
                  setIsMapModalOpen(true);
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 20l-5.447-2.724A1 1 0 0 1 3 16.382V5.618a1 1 0 0 1 1.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0 0 21 18.382V7.618a1 1 0 0 0-.553-.894L15 4m0 13V4m0 0L9 7"></path>
                </svg>
                Select by map
              </div>
              <div className="popup-item more-uploads">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
                More uploads
                <span className="arrow-right">&gt;</span>
              </div>
            </div>
          )}

          <input
            type="text"
            placeholder="Ask Anything"
            className="search-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {inputValue.trim() !== '' || hasAttachment ? (
            <div
              className="search-send-btn"
              onClick={handleSend}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="19" x2="12" y2="5"></line>
                <polyline points="5 12 12 5 19 12"></polyline>
              </svg>
            </div>
          ) : (
            <div className="search-mic-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
              </svg>
            </div>
          )}
        </div>

        {uploadError && (
          <div className="upload-error" role="alert">{uploadError}</div>
        )}

        <input
          type="file"
          multiple
          accept="image/*"
          style={{ display: 'none' }}
          ref={fileInputRef}
          onChange={handleFileUpload}
        />
      </div>
    </div>
  );

  return (
    <div className="searchpage-container">
      {!isLoggedIn && !hasQueried && (
        <div className="search-header-auth">
          <button className="auth-btn-login" onClick={onLogin}>Log in</button>
          <button className="auth-btn-signup" onClick={onSignup}>Sign up for free</button>
        </div>
      )}

      <div className="collapsed-sidebar" onClick={() => setIsSidebarOpen(true)}>
        <div className="sidebar-icons">
          <div className="sidebar-logo">
            <svg width="47" height="46" viewBox="0 0 47 46" fill="none" stroke="black" strokeWidth="1.5">
              <circle cx="23.5" cy="23" r="21"></circle>
              <ellipse cx="23.5" cy="23" rx="21" ry="6" transform="rotate(-25 23.5 23)"></ellipse>
              <circle cx="23.5" cy="23" r="3.5" fill="#00B4D8" stroke="none"></circle>
            </svg>
          </div>

          <div className="icon-group">
            <div
              className="sidebar-icon"
              title="Open dashboard"
              onClick={(event) => {
                event.stopPropagation();
                handleProtectedNavigate('dashboard');
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
            </div>
            <div
              className="sidebar-icon"
              title="Open history"
              onClick={(event) => {
                event.stopPropagation();
                handleProtectedNavigate('history');
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>
            <div
              className="sidebar-icon"
              title="Open reports"
              onClick={(event) => {
                event.stopPropagation();
                handleProtectedNavigate('reports');
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
            </div>
            <div
              className="sidebar-icon"
              title="Settings"
              onClick={(event) => {
                event.stopPropagation();
                handleProtectedNavigate('settings');
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </div>
          </div>
        </div>
      </div>

      {isSidebarOpen && (
        <div className="search-sidebar-layer" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <button
            className="search-sidebar-backdrop"
            aria-label="Close navigation menu"
            onClick={() => setIsSidebarOpen(false)}
          />
          <aside className="search-sidebar-panel">
            <button
              className="search-sidebar-close"
              aria-label="Close navigation menu"
              onClick={() => setIsSidebarOpen(false)}
            >
              ×
            </button>

            <div className="search-sidebar-brand">
              <svg width="42" height="42" viewBox="0 0 47 46" fill="none" stroke="black" strokeWidth="1.5" aria-hidden="true">
                <circle cx="23.5" cy="23" r="21"></circle>
                <ellipse cx="23.5" cy="23" rx="21" ry="6" transform="rotate(-25 23.5 23)"></ellipse>
                <circle cx="23.5" cy="23" r="3.5" fill="#00B4D8" stroke="none"></circle>
              </svg>
              <strong>SATQUERY <span>AI</span></strong>
            </div>

            <button className="search-sidebar-new" onClick={handleNewAnalysis}>
              <span>+</span> New Analysis
            </button>

            <nav className="search-sidebar-nav">
              <button className="search-sidebar-nav-item" onClick={() => { setIsSidebarOpen(false); handleProtectedNavigate('dashboard'); }}>
                <span className="sidebar-nav-icon">▦</span> Dashboard
              </button>
              <button className="search-sidebar-nav-item" onClick={() => { setIsSidebarOpen(false); handleProtectedNavigate('history'); }}>
                <span className="sidebar-nav-icon">◷</span> History
              </button>
              <button className="search-sidebar-nav-item" onClick={() => { setIsSidebarOpen(false); handleProtectedNavigate('reports'); }}>
                <span className="sidebar-nav-icon">▤</span> Reports
              </button>
              <button className="search-sidebar-nav-item" onClick={() => { setIsSidebarOpen(false); handleProtectedNavigate('settings'); }}>
                <span className="sidebar-nav-icon">⚙</span> Settings
              </button>
            </nav>

            {!isLoggedIn ? (
              <div className="sidebar-auth-promo-card">
                <div className="promo-card-title">Get responses tailored to you</div>
                <div className="promo-card-sub">
                  Log in to save chats, view analysis history & access dashboard.
                </div>
                <button className="promo-card-login-btn" onClick={onLogin}>
                  Log in
                </button>
              </div>
            ) : (
              <div className="search-sidebar-profile">
                <div className="search-sidebar-avatar">
                  {(user?.fullName || user?.email || 'M')[0].toUpperCase()}
                </div>
                <div className="profile-text-col">
                  <strong>{user?.fullName || 'Mayank'}</strong>
                </div>
                <button className="logout-icon-btn" title="Log out" onClick={onLogout}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                  </svg>
                </button>
              </div>
            )}
          </aside>
        </div>
      )}

      {showAuthModal && (
        <div className="auth-modal-backdrop" onClick={() => setShowAuthModal(false)}>
          <div className="auth-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="auth-modal-close-btn" onClick={() => setShowAuthModal(false)}>×</button>
            <div className="auth-modal-brand-logo">
              <svg width="42" height="42" viewBox="0 0 47 46" fill="none" stroke="black" strokeWidth="1.5">
                <circle cx="23.5" cy="23" r="21"></circle>
                <ellipse cx="23.5" cy="23" rx="21" ry="6" transform="rotate(-25 23.5 23)"></ellipse>
                <circle cx="23.5" cy="23" r="3.5" fill="#00B4D8" stroke="none"></circle>
              </svg>
            </div>
            <h2 className="auth-modal-title">Sign in to access {authModalFeature ? authModalFeature.toUpperCase() : 'History & Dashboard'}</h2>
            <p className="auth-modal-desc">
              Log in or create a free account to save your satellite queries, view past analysis history, and download reports.
            </p>
            <div className="auth-modal-btn-group">
              <button className="modal-btn-login" onClick={() => { setShowAuthModal(false); if (onLogin) onLogin(); }}>
                Log in
              </button>
              <button className="modal-btn-signup" onClick={() => { setShowAuthModal(false); if (onSignup) onSignup(); }}>
                Sign up for free
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={`searchpage-content ${hasQueried ? 'has-results' : ''}`}>
        {!hasQueried ? (
          <div className="initial-search-container">
            {searchBarElement}
          </div>
        ) : (
          <div className="results-container">
            <div className="chat-section">
              <div className="chat-history">
                {sentFiles.length > 0 && (
                  <div className="message user-message image-message" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', backgroundColor: 'transparent', padding: '0', boxShadow: 'none' }}>
                    {sentFiles.map((f, i) => (
                      <img key={i} src={f.preview} alt="uploaded" style={{ maxWidth: '200px', maxHeight: '150px', borderRadius: '12px', objectFit: 'cover' }} />
                    ))}
                  </div>
                )}
                {queryText && (
                  <div className="message user-message">{queryText}</div>
                )}
                {messages.length > 0 && (
                  messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`message ${(msg.role === 'user' || msg.role === 'USER') ? 'user-message' : 'ai-message'}`}
                    >
                      {(msg.role === 'user' || msg.role === 'USER') ? msg.content : renderStructuredText(msg.content)}
                    </div>
                  ))
                )}

                {isLoading && (
                  <div className="message ai-message ml-status-card" style={{ width: '100%', maxWidth: '90%', padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', color: '#0F172A', fontSize: '13px', marginBottom: '8px' }}>
                      <span className="status-pulse-dot"></span>
                      ML Analysis Progress
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {mlStatusHistory.length > 0 ? (
                        mlStatusHistory.map((item) => (
                          <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', background: '#FFFFFF', padding: '6px 10px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                            <span style={{ fontWeight: '600', color: '#1E293B' }}>
                              {item.status === 'COMPLETED' ? '✓ ' : '● '}
                              {item.title}
                            </span>
                            <span style={{ fontSize: '11px', fontWeight: '700', color: item.status === 'COMPLETED' ? '#10B981' : '#00B4D8' }}>
                              {item.status}
                              {item.attempt ? ` (Attempt ${item.attempt})` : ''}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div style={{ fontSize: '12px', color: '#64748B' }}>Initializing ML Pipeline...</div>
                      )}
                    </div>

                    {mlSessionId && (
                      <div style={{ fontSize: '11px', color: '#64748B', marginTop: '8px', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                        Session: {mlSessionId}
                      </div>
                    )}
                  </div>
                )}

                {isLoading && (
                  <div className="loading-dots">
                    <span className="dot"></span><span className="dot"></span><span className="dot"></span>
                  </div>
                )}
              </div>
              <div className="chat-input-area">
                {searchBarElement}
              </div>
            </div>

            <div className="analysis-section">
              {analysisComplete ? (
                <div className="analysis-results-card">
                  <div className="results-header-top">
                    <div className="badge-complete">
                      <span className="dot-circle"></span>
                      ANALYSIS COMPLETE
                    </div>
                    <div className="results-actions">
                      <button className="btn-secondary" onClick={handleExportJson}>Export JSON</button>
                      <button className="btn-primary" onClick={handleDownloadReport}>Download Report</button>
                    </div>
                  </div>

                  <h2 className="results-title">Analysis Results</h2>
                  <div className="results-query">
                    Query: "{R.query || queryText || 'Describe this image .'}"
                    {R.current_task && <span className="query-task-pill">{toTitle(R.current_task)}</span>}
                    {R.temporal_mode && <span className="query-task-pill alt">{toTitle(R.temporal_mode)}</span>}
                  </div>

                  <div className="results-tabs">
                    <button
                      className={`result-tab-btn ${activeResultTab === 'overview' ? 'active' : ''}`}
                      onClick={() => setActiveResultTab('overview')}
                    >
                      Overview
                    </button>
                    <button
                      className={`result-tab-btn ${activeResultTab === 'evidence' ? 'active' : ''}`}
                      onClick={() => setActiveResultTab('evidence')}
                    >
                      Evidence{evidenceItems.length > 0 ? ` (${evidenceItems.length})` : ''}
                    </button>
                    <button
                      className={`result-tab-btn ${activeResultTab === 'layers' ? 'active' : ''}`}
                      onClick={() => setActiveResultTab('layers')}
                    >
                      Artifacts{artifacts.length > 0 ? ` (${artifacts.length})` : ''}
                    </button>
                    <button
                      className={`result-tab-btn ${activeResultTab === 'trace' ? 'active' : ''}`}
                      onClick={() => setActiveResultTab('trace')}
                    >
                      Agent Trace
                    </button>
                    <button
                      className={`result-tab-btn ${activeResultTab === 'metadata' ? 'active' : ''}`}
                      onClick={() => setActiveResultTab('metadata')}
                    >
                      Metadata
                    </button>
                  </div>

                  {activeResultTab === 'overview' && (
                    <>
                      <div className="results-overview-grid">
                        <div
                          className={`evidence-image-container${showChangeMap ? ' contain-img' : ''}`}
                          style={{ backgroundImage: `url("${overviewImage}")` }}
                        >
                          {showChangeMap && showEvidence && bbox && (
                            <div
                              className="bounding-box cyan"
                              style={{
                                left: `${bbox[0] * 100}%`,
                                top: `${bbox[1] * 100}%`,
                                width: `${(bbox[2] - bbox[0]) * 100}%`,
                                height: `${(bbox[3] - bbox[1]) * 100}%`,
                              }}
                            >
                              <span className="box-label cyan">
                                CHANGE {changeStats?.changed_fraction != null ? asPercent(changeStats.changed_fraction) : ''}
                              </span>
                            </div>
                          )}
                          {changeMapArtifact && (
                            <div className="img-mode-toggle">
                              <button
                                className={overviewImageMode === 'change' ? 'active' : ''}
                                onClick={() => setOverviewImageMode('change')}
                              >CHANGE MAP</button>
                              <button
                                className={overviewImageMode === 'source' ? 'active' : ''}
                                onClick={() => setOverviewImageMode('source')}
                              >SOURCE</button>
                            </div>
                          )}
                          {showChangeMap && bbox && (
                            <button
                              className="hide-evidence-btn"
                              onClick={() => setShowEvidence(!showEvidence)}
                            >
                              {showEvidence ? 'HIDE BOX' : 'SHOW BOX'}
                            </button>
                          )}
                        </div>

                        <div className="synthesis-text-container">
                          <div className="synthesis-heading">GLOBAL SYNTHESIS</div>
                          <div className="synthesis-content">
                            {(R.final_answer || latestAiAnswer) ? (
                              renderStructuredText(R.final_answer || latestAiAnswer)
                            ) : (
                              <p>Awaiting synthesised answer from the analysis pipeline.</p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="results-bottom-row">
                        <div className="confidence-box">
                          <div className="box-subtitle">AI CONFIDENCE</div>
                          <div className="confidence-large-number">{asPercent(overallConfidence)}</div>
                          {[
                            { label: 'Answer Confidence', value: overallConfidence },
                            { label: 'Reflection Confidence', value: reflection?.confidence },
                            { label: 'Evidence Confidence', value: reflection?.evidence_confidence ?? primaryEvidence?.confidence },
                            { label: 'Min Threshold', value: reflection?.min_confidence },
                          ].filter(m => m.value != null).map((m, i) => {
                            const w = (m.value <= 1 ? m.value * 100 : m.value);
                            return (
                              <div className="confidence-metric-item" key={i}>
                                <div className="metric-text-row">
                                  <span>{m.label}</span>
                                  <span>{asPercent(m.value)}</span>
                                </div>
                                <div className="metric-bar-bg">
                                  <div className="metric-bar-fill" style={{ width: `${w}%` }}></div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="model-details-box">
                          <div className="box-subtitle">ANALYSIS</div>
                          <div className="model-name">{toTitle(R.current_task) || 'Earth Observation'}</div>
                          <div className="model-spec-table">
                            <div className="model-spec-row">
                              <span>Temporal Mode</span>
                              <span>{toTitle(R.temporal_mode) || '—'}</span>
                            </div>
                            <div className="model-spec-row">
                              <span>Images</span>
                              <span>{R.image_count ?? '—'}</span>
                            </div>
                            <div className="model-spec-row">
                              <span>Modalities</span>
                              <span>{formatValue(R.modalities)}</span>
                            </div>
                            <div className="model-spec-row">
                              <span>Retries</span>
                              <span>{R.retry_count ?? 0}</span>
                            </div>
                            <div className="model-spec-row">
                              <span>Decision</span>
                              <span className="status-pill-green">{reflection?.decision || (R.input_valid ? 'Valid' : '—')}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {changeStats && (
                        <div className="change-stats-strip">
                          <div className="box-subtitle">CHANGE STATISTICS</div>
                          <div className="change-stats-grid">
                            <KV label="Changed Fraction" value={asPercent(changeStats.changed_fraction)} />
                            <KV label="Method" value={toTitle(changeStats.method)} />
                            <KV label="Threshold" value={formatValue(changeStats.threshold)} />
                            <KV label="Change BBox" value={bbox ? bbox.map(n => Number(n).toFixed(3)).join(', ') : '—'} />
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {activeResultTab === 'trace' && (
                    <div className="agent-trace-container">
                      <div className="trace-top-bar">
                        <div className="agent-trace-meta" style={{ marginBottom: 0 }}>
                          EXECUTION TRACE — {traceSteps.length} {traceSteps.length === 1 ? 'STEP' : 'STEPS'}
                          {totalDuration != null && ` • ${Number(totalDuration).toFixed(2)}s TOTAL`}
                          {R.retry_count != null && ` • ${R.retry_count} RETRIES`}
                        </div>
                        {traceSteps.length > 0 && (
                          <button className="trace-toggle-all-btn" onClick={() => toggleAllTraceSteps(traceSteps.length)}>
                            {traceSteps.some((_, i) => isStepOpen(i)) ? 'Collapse All' : 'Expand All'}
                          </button>
                        )}
                      </div>

                      {traceSteps.length === 0 && (
                        <div className="empty-note">No execution trace returned by the backend.</div>
                      )}

                      {traceSteps.map((step, i) => {
                        const extraKeys = Object.keys(step || {}).filter(k => k !== 'node' && k !== 'status');
                        const done = String(step?.status || '').toLowerCase() === 'completed';
                        return (
                          <div className="trace-step-card" key={i}>
                            <div className="trace-step-header" onClick={() => toggleTraceStep(i)}>
                              <div className="trace-step-left">
                                <span className="trace-step-number">{String(i + 1).padStart(2, '0')}</span>
                                <span className="trace-step-title">{toTitle(step?.node) || `Step ${i + 1}`}</span>
                              </div>
                              <div className="trace-step-right">
                                <span className={done ? 'trace-status-complete' : 'trace-status-pending'}>
                                  {done ? '✓ ' : ''}{(step?.status || 'unknown').toUpperCase()}
                                </span>
                                <span className="trace-chevron">{isStepOpen(i) ? '▲' : '▼'}</span>
                              </div>
                            </div>
                            {isStepOpen(i) && (
                              <div className="trace-step-details">
                                {extraKeys.length === 0 && (
                                  <div className="trace-detail-col"><span className="trace-detail-val">No additional data</span></div>
                                )}
                                {extraKeys.map(k => (
                                  <div className="trace-detail-col" key={k}>
                                    <span className="trace-detail-label">{toTitle(k)}</span>
                                    <span className="trace-detail-val">{formatValue(step[k])}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {reflection && (
                        <div className="reflection-card">
                          <div className="metadata-card-header">REFLECTION</div>
                          <div className="metadata-grid-specs">
                            <div className="meta-spec-item">
                              <span className="meta-spec-label">DECISION</span>
                              <span className="meta-spec-value">{reflection.decision || '—'}</span>
                            </div>
                            <div className="meta-spec-item">
                              <span className="meta-spec-label">REQUIRED ACTION</span>
                              <span className="meta-spec-value">{reflection.required_action || '—'}</span>
                            </div>
                            <div className="meta-spec-item">
                              <span className="meta-spec-label">CONFIDENCE</span>
                              <span className="meta-spec-value">{asPercent(reflection.confidence)}</span>
                            </div>
                            <div className="meta-spec-item">
                              <span className="meta-spec-label">EVIDENCE CONFIDENCE</span>
                              <span className="meta-spec-value">{asPercent(reflection.evidence_confidence)}</span>
                            </div>
                            <div className="meta-spec-item">
                              <span className="meta-spec-label">MIN CONFIDENCE</span>
                              <span className="meta-spec-value">{asPercent(reflection.min_confidence)}</span>
                            </div>
                            <div className="meta-spec-item">
                              <span className="meta-spec-label">RETRY COUNT</span>
                              <span className="meta-spec-value">{reflection.retry_count ?? 0}</span>
                            </div>
                          </div>
                          {reflection.reason && (
                            <pre className="evidence-finding-pre">{reflection.reason}</pre>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {activeResultTab === 'metadata' && (
                    <div className="metadata-tab-container">
                      <div className="metadata-card">
                        <div className="metadata-card-header">ANALYSIS METADATA</div>
                        <div className="metadata-grid-specs">
                          <div className="meta-spec-item">
                            <span className="meta-spec-label">QUERY</span>
                            <span className="meta-spec-value">{R.query || queryText || '—'}</span>
                          </div>
                          <div className="meta-spec-item">
                            <span className="meta-spec-label">CURRENT TASK</span>
                            <span className="meta-spec-value">{toTitle(R.current_task) || '—'}</span>
                          </div>
                          <div className="meta-spec-item">
                            <span className="meta-spec-label">TEMPORAL MODE</span>
                            <span className="meta-spec-value">{toTitle(R.temporal_mode) || '—'}</span>
                          </div>
                          <div className="meta-spec-item">
                            <span className="meta-spec-label">IMAGE COUNT</span>
                            <span className="meta-spec-value">{R.image_count ?? '—'}</span>
                          </div>
                          <div className="meta-spec-item">
                            <span className="meta-spec-label">MODALITIES</span>
                            <span className="meta-spec-value">{formatValue(R.modalities)}</span>
                          </div>
                          <div className="meta-spec-item">
                            <span className="meta-spec-label">INPUT VALID</span>
                            <span className="meta-spec-value">{formatValue(R.input_valid)}</span>
                          </div>
                          <div className="meta-spec-item">
                            <span className="meta-spec-label">VALIDATION ERRORS</span>
                            <span className="meta-spec-value">
                              {Array.isArray(R.validation_errors) && R.validation_errors.length
                                ? R.validation_errors.join('; ') : 'None'}
                            </span>
                          </div>
                          <div className="meta-spec-item">
                            <span className="meta-spec-label">RETRY COUNT</span>
                            <span className="meta-spec-value">{R.retry_count ?? '—'}</span>
                          </div>
                          <div className="meta-spec-item">
                            <span className="meta-spec-label">ANSWER CONFIDENCE</span>
                            <span className="meta-spec-value">{asPercent(R.confidence)}</span>
                          </div>
                          <div className="meta-spec-item">
                            <span className="meta-spec-label">DURATION</span>
                            <span className="meta-spec-value">{totalDuration != null ? `${Number(totalDuration).toFixed(2)}s` : '—'}</span>
                          </div>
                          <div className="meta-spec-item">
                            <span className="meta-spec-label">EVIDENCE ITEMS</span>
                            <span className="meta-spec-value">{evidenceItems.length}</span>
                          </div>
                          <div className="meta-spec-item">
                            <span className="meta-spec-label">ARTIFACTS</span>
                            <span className="meta-spec-value">{artifacts.length}</span>
                          </div>
                        </div>
                      </div>

                      {reflection && (
                        <div className="metadata-card" style={{ marginTop: '12px' }}>
                          <div className="metadata-card-header">REFLECTION</div>
                          <div className="metadata-grid-specs">
                            {Object.entries(reflection).filter(([k]) => k !== 'reason').map(([k, v]) => (
                              <div className="meta-spec-item" key={k}>
                                <span className="meta-spec-label">{toTitle(k)}</span>
                                <span className="meta-spec-value">
                                  {typeof v === 'number' && v <= 1 && v > 0 ? asPercent(v) : formatValue(v)}
                                </span>
                              </div>
                            ))}
                          </div>
                          {reflection.reason && <pre className="evidence-finding-pre">{reflection.reason}</pre>}
                        </div>
                      )}

                      <div className="metadata-card" style={{ marginTop: '12px' }}>
                        <div
                          className="metadata-card-header raw-json-toggle"
                          onClick={() => setShowRawJson(v => !v)}
                        >
                          RAW BACKEND RESPONSE <span>{showRawJson ? '▲' : '▼'}</span>
                        </div>
                        {showRawJson && (
                          <pre className="raw-json-pre">
                            {rawBackendResponse
                              ? JSON.stringify(rawBackendResponse, null, 2)
                              : "No backend response received yet."}
                          </pre>
                        )}
                      </div>
                    </div>
                  )}

                  {activeResultTab === 'evidence' && (
                    <div className="evidence-tab-container">
                      {evidenceItems.length === 0 && (
                        <div className="empty-note">No evidence returned by the backend.</div>
                      )}

                      {evidenceItems.map((ev, idx) => {
                        const art = artifactForEvidence(ev);
                        const cs = ev?.change_stats || null;
                        const okStatus = String(ev?.status || '').toLowerCase() === 'ok';
                        return (
                          <div className="evidence-detail-card" key={ev?.evidence_id || idx}>
                            <div className="evidence-detail-head">
                              <div>
                                <div className="evidence-card-title">{toTitle(ev?.agent) || `Evidence ${idx + 1}`}</div>
                                <div className="evidence-sub">{ev?.evidence_id} · {toTitle(ev?.task)}</div>
                              </div>
                              <span className={okStatus ? 'status-pill-green' : 'status-pill-amber'}>
                                {(ev?.status || 'unknown').toUpperCase()}
                              </span>
                            </div>

                            {art?.image_b64 && (
                              <img className="evidence-artifact-img" src={art.image_b64} alt={art.artifact_id || 'artifact'} />
                            )}

                            <div className="evidence-stats-grid">
                              <div className="evidence-stat-col">
                                <span className="evidence-stat-label">Confidence</span>
                                <span className="evidence-stat-value">{asPercent(ev?.confidence)}</span>
                              </div>
                              <div className="evidence-stat-col">
                                <span className="evidence-stat-label">Task</span>
                                <span className="evidence-stat-value">{toTitle(ev?.task) || '—'}</span>
                              </div>
                              <div className="evidence-stat-col">
                                <span className="evidence-stat-label">Visual Evidence</span>
                                <span className="evidence-stat-value">{formatValue(ev?.visual_evidence)}</span>
                              </div>
                              <div className="evidence-stat-col">
                                <span className="evidence-stat-label">Boxes</span>
                                <span className="evidence-stat-value">
                                  {Array.isArray(ev?.boxes) ? ev.boxes.length : (ev?.boxes == null ? 'None' : formatValue(ev.boxes))}
                                </span>
                              </div>
                            </div>

                            {cs && (
                              <div className="change-stats-grid" style={{ marginTop: '10px' }}>
                                <KV label="Changed Fraction" value={asPercent(cs.changed_fraction)} />
                                <KV label="Method" value={toTitle(cs.method)} />
                                <KV label="Threshold" value={formatValue(cs.threshold)} />
                                <KV label="Change BBox" value={Array.isArray(cs.change_bbox) ? cs.change_bbox.map(n => Number(n).toFixed(3)).join(', ') : '—'} />
                              </div>
                            )}

                            {ev?.verified_finding && (
                              <div className="finding-block">
                                <span className="finding-label">Verified Finding</span>
                                <pre className="evidence-finding-pre">{ev.verified_finding}</pre>
                              </div>
                            )}
                            {ev?.finding && (
                              <div className="finding-block">
                                <span className="finding-label">Raw Finding</span>
                                <pre className="evidence-finding-pre">{ev.finding}</pre>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {activeResultTab === 'layers' && (
                    <div className="layers-tab-container">
                      {artifacts.length === 0 && (
                        <div className="empty-note">No artifacts returned by the backend.</div>
                      )}
                      {artifacts.map((art, idx) => (
                        <div className="artifact-card" key={art?.artifact_id || idx}>
                          <div className="artifact-head">
                            <span className="layer-title-text">{toTitle(art?.kind) || 'Artifact'}</span>
                            <span className="layer-desc-text">{art?.artifact_id}</span>
                          </div>
                          {art?.image_b64 && (
                            <img className="artifact-img" src={art.image_b64} alt={art.artifact_id || 'artifact'} />
                          )}
                          <div className="change-stats-grid">
                            <KV label="Kind" value={toTitle(art?.kind)} />
                            <KV label="Produced By" value={toTitle(art?.produced_by)} />
                          </div>
                        </div>
                      ))}

                      {evidenceItems.some(e => e?.visual_evidence?.length) && (
                        <div className="artifact-card">
                          <div className="artifact-head">
                            <span className="layer-title-text">Visual Evidence References</span>
                          </div>
                          <div className="chip-row">
                            {[...new Set(evidenceItems.flatMap(e => e?.visual_evidence || []))].map((v, i) => (
                              <span className="ve-chip" key={i}>{v}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="sp-analysis-card">
                  <div className="analysis-header">
                    <span className="agent-title">SATQUERY AGENT <span className="agent-status">- ACTIVE</span></span>
                    <h2>Analyzing Earth Observation Data</h2>
                  </div>

                  <div className="analysis-image" style={{ backgroundImage: sentFiles.length > 0 ? `url('${sentFiles[0].preview}')` : "url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80')" }}>
                    <div className="image-badges">
                      <span className="badge dark">SENTINEL 2</span>
                      <span className="badge dark">OPTICAL</span>
                      <span className="badge dark">10m</span>
                    </div>
                  </div>

                  <div className="analysis-details">
                    <div className="compatibility-check">
                      <h3>Compatibility Check</h3>
                      <div className="comp-card">
                        <div className="comp-card-header">
                          <div className="comp-thumb" style={{ backgroundImage: sentFiles.length > 0 ? `url('${sentFiles[0].preview}')` : "url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=200&q=80')" }}></div>
                          <div className="comp-title">
                            <strong>{sentFiles.length > 0 ? sentFiles[0].name : 'satellite_image.tif'}</strong>
                            <span>14.2 MB - Uploaded 2014-02-23</span>
                          </div>
                          <div className="comp-status">✓ COMPATIBLE</div>
                        </div>
                        <div className="comp-stats">
                          <div className="stat-col">
                            <span className="stat-label">FORMAT</span>
                            <span className="stat-val">GeoTIFF</span>
                          </div>
                          <div className="stat-col">
                            <span className="stat-label">MODALITY</span>
                            <span className="stat-val">Optical</span>
                          </div>
                          <div className="stat-col">
                            <span className="stat-label">RESOLUTION</span>
                            <span className="stat-val">10 m</span>
                          </div>
                          <div className="stat-col">
                            <span className="stat-label">CRS</span>
                            <span className="stat-val">EPSG:4326</span>
                          </div>
                          <div className="stat-col">
                            <span className="stat-label">ACQUISITION</span>
                            <span className="stat-val">12 Aug 2026</span>
                          </div>
                          <div className="stat-col">
                            <span className="stat-label">BANDS</span>
                            <span className="stat-val">13 (Sentinel-2)</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="execution-timeline">
                      <h3>EXECUTION TIMELINE</h3>
                      <ul className="timeline-list">
                        {[
                          "Input validated",
                          "Query understood",
                          "Task identified",
                          "Specialist selected",
                          "Running analysis",
                          "Generating evidence",
                          "Preparing response"
                        ].map((stepLabel, idx) => {
                          let stepClass = "pending";
                          if (idx < timelineStep) stepClass = "done";
                          else if (idx === timelineStep) stepClass = "active";

                          const isCurrentActive = stepClass === "active";
                          let liveStatusText = "PROCESSING...";

                          if (isCurrentActive && mlStatusPayload?.node) {
                            const nodeName = String(mlStatusPayload.node).toUpperCase();
                            const statusVal = String(mlStatusPayload.status || 'PROCESSING').toUpperCase();
                            if (statusVal === 'RETRYING' || nodeName === 'RETRY') {
                              const target = mlStatusPayload.target ? String(mlStatusPayload.target).toUpperCase() : nodeName;
                              const attempt = mlStatusPayload.attempt || 1;
                              liveStatusText = `RETRYING ${target} (ATTEMPT ${attempt})...`;
                            } else {
                              liveStatusText = `${nodeName} → ${statusVal}...`;
                            }
                          }

                          return (
                            <li key={idx} className={stepClass}>
                              {stepLabel}
                              {isCurrentActive && <span className="processing-text">{liveStatusText}</span>}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {isDashboardPanelOpen && (
        <div className="dashboard-panel-layer" role="dialog" aria-modal="true" aria-label="Dashboard">
          <button
            className="dashboard-panel-backdrop"
            aria-label="Close dashboard"
            onClick={() => setIsDashboardPanelOpen(false)}
          />
          <aside className="dashboard-panel">
            <button
              className="dashboard-panel-close"
              aria-label="Close dashboard"
              onClick={() => setIsDashboardPanelOpen(false)}
            >
              ×
            </button>
            <Dashboard
              initialTab="dashboard"
              onNewAnalysis={handleNewAnalysis}
            />
          </aside>
        </div>
      )}

      {isMapModalOpen && (
        <MapSelectModal
          onClose={() => setIsMapModalOpen(false)}
          onConfirm={handleMapRegionConfirm}
        />
      )}
    </div>
  );
}