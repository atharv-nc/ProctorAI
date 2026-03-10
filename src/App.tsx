import React, { useState, useEffect, useRef } from 'react';
import { FaceLandmarker, FilesetResolver, FaceLandmarkerResult } from '@mediapipe/tasks-vision';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, AlertTriangle, User, Hash, Play, CheckCircle, XCircle, RefreshCcw, Eye, Users, EyeOff, ExternalLink, ShieldCheck, GraduationCap, LayoutDashboard, Search, Filter, ArrowRight, Move, Sun, ScanFace, Share2, Mail, Lock, LogOut } from 'lucide-react';
import * as faceapi from 'face-api.js';
import { Student, ExamReport, ExamViolation, UserRole, Exam, Question, QuestionType } from './types';
import { GoogleGenAI, Type } from "@google/genai";
import { cn } from './lib/utils';
import { auth, db } from './firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, User as FirebaseUser } from 'firebase/auth';
import { collection, doc, setDoc, getDoc, getDocs, query, where, addDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';

// --- Constants ---
const WARNING_THRESHOLD = 3;
const LOOK_AWAY_TIME_THRESHOLD = 5000; // 5 seconds
const YAW_THRESHOLD = 0.4; // Radians for looking left/right
const PITCH_THRESHOLD = 0.3; // Radians for looking up/down
const MOVEMENT_THRESHOLD = 0.08; // Threshold for significant face position change

const GLOBAL_QUESTION_BANK: Question[] = [
  // --- Computer Science (Engineering) ---
  { id: "cs-e-1", category: "Engineering", subCategory: "Computer Science", difficulty: "EASY", type: "MCQ", text: "What is the time complexity of binary search?", options: ["O(n)", "O(log n)", "O(n^2)", "O(1)"], correctAnswer: 1 },
  { id: "cs-m-1", category: "Engineering", subCategory: "Computer Science", difficulty: "MEDIUM", type: "MCQ", text: "Which data structure is used for BFS in a graph?", options: ["Stack", "Queue", "Priority Queue", "Tree"], correctAnswer: 1 },
  { id: "cs-h-1", category: "Engineering", subCategory: "Computer Science", difficulty: "HARD", type: "MCQ", text: "In a B-Tree of order m, what is the maximum number of children a node can have?", options: ["m", "m-1", "m/2", "2m"], correctAnswer: 0 },
  { id: "cs-tf-1", category: "Engineering", subCategory: "Computer Science", difficulty: "EASY", type: "TRUE_FALSE", text: "HTTP is a stateful protocol.", options: ["True", "False"], correctAnswer: 1 },
  { id: "cs-fib-1", category: "Engineering", subCategory: "Computer Science", difficulty: "MEDIUM", type: "FILL_IN_THE_BLANKS", text: "The ______ layer of the OSI model is responsible for routing.", options: [], correctAnswer: "Network" },
  { id: "cs-e-2", category: "Engineering", subCategory: "Computer Science", difficulty: "EASY", type: "MCQ", text: "Which of the following is not a programming language?", options: ["Python", "Java", "HTML", "C++"], correctAnswer: 2 },
  { id: "cs-m-2", category: "Engineering", subCategory: "Computer Science", difficulty: "MEDIUM", type: "MCQ", text: "What is the size of an int in Java?", options: ["16-bit", "32-bit", "64-bit", "8-bit"], correctAnswer: 1 },
  { id: "cs-h-2", category: "Engineering", subCategory: "Computer Science", difficulty: "HARD", type: "MCQ", text: "Which algorithm is used for finding the shortest path in a weighted graph with no negative edges?", options: ["Dijkstra", "Bellman-Ford", "Floyd-Warshall", "Prim"], correctAnswer: 0 },
  
  // --- Mechanical Engineering ---
  { id: "me-e-1", category: "Engineering", subCategory: "Mechanical", difficulty: "EASY", type: "MCQ", text: "What is the unit of power in SI units?", options: ["Joule", "Watt", "Newton", "Pascal"], correctAnswer: 1 },
  { id: "me-m-1", category: "Engineering", subCategory: "Mechanical", difficulty: "MEDIUM", type: "MCQ", text: "Which cycle is used in petrol engines?", options: ["Diesel cycle", "Otto cycle", "Carnot cycle", "Rankine cycle"], correctAnswer: 1 },
  { id: "me-h-1", category: "Engineering", subCategory: "Mechanical", difficulty: "HARD", type: "MCQ", text: "What is the Poisson's ratio for a perfectly incompressible material?", options: ["0.5", "0.3", "0.25", "0.1"], correctAnswer: 0 },
  { id: "me-e-2", category: "Engineering", subCategory: "Mechanical", difficulty: "EASY", type: "MCQ", text: "Which of the following is a unit of pressure?", options: ["Newton", "Pascal", "Joule", "Watt"], correctAnswer: 1 },
  { id: "me-m-2", category: "Engineering", subCategory: "Mechanical", difficulty: "MEDIUM", type: "MCQ", text: "The first law of thermodynamics is a statement of:", options: ["Conservation of mass", "Conservation of energy", "Conservation of momentum", "None of these"], correctAnswer: 1 },

  // --- JEE ---
  { id: "jee-p-e-1", category: "JEE", subCategory: "Physics", difficulty: "EASY", type: "MCQ", text: "What is the dimensional formula for Force?", options: ["MLT^-2", "ML^2T^-2", "MLT^-1", "ML^2T^-1"], correctAnswer: 0 },
  { id: "jee-p-m-2", category: "JEE", subCategory: "Physics", difficulty: "MEDIUM", type: "MCQ", text: "The escape velocity from the Earth's surface is approximately:", options: ["11.2 km/s", "9.8 km/s", "7.9 km/s", "1.6 km/s"], correctAnswer: 0 },
  { id: "jee-p-h-2", category: "JEE", subCategory: "Physics", difficulty: "HARD", type: "MCQ", text: "In a Young's double slit experiment, if the distance between the slits is halved and the distance between the slits and the screen is doubled, the fringe width becomes:", options: ["Half", "Double", "Four times", "Unchanged"], correctAnswer: 2 },
  { id: "jee-c-m-1", category: "JEE", subCategory: "Chemistry", difficulty: "MEDIUM", type: "MCQ", text: "Which of the following has the highest electronegativity?", options: ["Oxygen", "Fluorine", "Chlorine", "Nitrogen"], correctAnswer: 1 },
  { id: "jee-c-e-2", category: "JEE", subCategory: "Chemistry", difficulty: "EASY", type: "MCQ", text: "What is the pH of a neutral solution at 25°C?", options: ["0", "7", "14", "1"], correctAnswer: 1 },
  { id: "jee-c-h-2", category: "JEE", subCategory: "Chemistry", difficulty: "HARD", type: "MCQ", text: "The number of sigma and pi bonds in benzene are:", options: ["12, 3", "6, 3", "9, 3", "12, 6"], correctAnswer: 0 },
  { id: "jee-m-h-1", category: "JEE", subCategory: "Maths", difficulty: "HARD", type: "MCQ", text: "The value of integral of sin^2(x) from 0 to pi/2 is:", options: ["pi/2", "pi/4", "1", "0"], correctAnswer: 1 },
  { id: "jee-m-e-2", category: "JEE", subCategory: "Maths", difficulty: "EASY", type: "MCQ", text: "The slope of the line 3x + 4y = 7 is:", options: ["3/4", "-3/4", "4/3", "-4/3"], correctAnswer: 1 },
  { id: "jee-m-m-2", category: "JEE", subCategory: "Maths", difficulty: "MEDIUM", type: "MCQ", text: "The number of ways to arrange 5 people in a circle is:", options: ["120", "24", "60", "25"], correctAnswer: 1 },

  // --- NEET ---
  { id: "neet-b-e-1", category: "NEET", subCategory: "Biology", difficulty: "EASY", type: "MCQ", text: "Which cell organelle is known as the powerhouse of the cell?", options: ["Nucleus", "Mitochondria", "Ribosome", "Golgi Body"], correctAnswer: 1 },
  { id: "neet-b-m-2", category: "NEET", subCategory: "Biology", difficulty: "MEDIUM", type: "MCQ", text: "The process of double fertilization is characteristic of:", options: ["Gymnosperms", "Angiosperms", "Pteridophytes", "Bryophytes"], correctAnswer: 1 },
  { id: "neet-b-h-2", category: "NEET", subCategory: "Biology", difficulty: "HARD", type: "MCQ", text: "Which of the following is not a stop codon?", options: ["UAA", "UAG", "UGA", "AUG"], correctAnswer: 3 },
  { id: "neet-p-m-1", category: "NEET", subCategory: "Physics", difficulty: "MEDIUM", type: "MCQ", text: "A body of mass 5kg is moving with a velocity of 10m/s. Its kinetic energy is:", options: ["250 J", "50 J", "500 J", "100 J"], correctAnswer: 0 },
  { id: "neet-c-h-1", category: "NEET", subCategory: "Chemistry", difficulty: "HARD", type: "MCQ", text: "The oxidation state of Cr in K2Cr2O7 is:", options: ["+3", "+4", "+5", "+6"], correctAnswer: 3 },

  // --- UPSC ---
  { id: "upsc-h-e-1", category: "UPSC", subCategory: "History", difficulty: "EASY", type: "MCQ", text: "Who was the first Governor-General of independent India?", options: ["Lord Mountbatten", "C. Rajagopalachari", "Dr. Rajendra Prasad", "Jawaharlal Nehru"], correctAnswer: 0 },
  { id: "upsc-p-m-1", category: "UPSC", subCategory: "Polity", difficulty: "MEDIUM", type: "MCQ", text: "Which article of the Indian Constitution deals with the Right to Equality?", options: ["Article 14", "Article 19", "Article 21", "Article 32"], correctAnswer: 0 },
  { id: "upsc-e-h-1", category: "UPSC", subCategory: "Economy", difficulty: "HARD", type: "MCQ", text: "What is the main objective of the 'Fiscal Responsibility and Budget Management Act, 2003'?", options: ["To reduce fiscal deficit", "To increase tax revenue", "To control inflation", "To promote exports"], correctAnswer: 0 },

  // --- Class 10 ---
  { id: "c10-m-e-1", category: "Class 10", subCategory: "Maths", difficulty: "EASY", type: "MCQ", text: "The HCF of 135 and 225 is:", options: ["45", "15", "5", "9"], correctAnswer: 0 },
  { id: "c10-s-m-1", category: "Class 10", subCategory: "Science", difficulty: "MEDIUM", type: "MCQ", text: "Which part of the eye controls the amount of light entering it?", options: ["Cornea", "Iris", "Pupil", "Retina"], correctAnswer: 1 },
  { id: "c10-ss-h-1", category: "Class 10", subCategory: "Social Science", difficulty: "HARD", type: "MCQ", text: "In which year did the French Revolution start?", options: ["1789", "1776", "1815", "1848"], correctAnswer: 0 },

  // --- Class 12 ---
  { id: "c12-p-e-1", category: "Class 12", subCategory: "Physics", difficulty: "EASY", type: "MCQ", text: "What is the SI unit of electric charge?", options: ["Coulomb", "Ampere", "Volt", "Ohm"], correctAnswer: 0 },
  { id: "c12-c-m-1", category: "Class 12", subCategory: "Chemistry", difficulty: "MEDIUM", type: "MCQ", text: "What is the coordination number of Fe in [Fe(CN)6]^4-?", options: ["4", "6", "2", "8"], correctAnswer: 1 },
  { id: "c12-b-h-1", category: "Class 12", subCategory: "Biology", difficulty: "HARD", type: "MCQ", text: "Which of the following is a start codon?", options: ["AUG", "UAA", "UAG", "UGA"], correctAnswer: 0 },

  // --- Physics (General) ---
  { id: "phys-1", category: "Physics", subCategory: "Mechanics", difficulty: "EASY", type: "MCQ", text: "What is the acceleration due to gravity on Earth?", options: ["9.8 m/s^2", "8.9 m/s^2", "10 m/s^2", "9.1 m/s^2"], correctAnswer: 0 },
  { id: "phys-2", category: "Physics", subCategory: "Optics", difficulty: "MEDIUM", type: "MCQ", text: "The speed of light in vacuum is approximately:", options: ["3 x 10^8 m/s", "3 x 10^6 m/s", "3 x 10^5 m/s", "3 x 10^7 m/s"], correctAnswer: 0 },
  { id: "phys-3", category: "Physics", subCategory: "Thermodynamics", difficulty: "HARD", type: "MCQ", text: "The absolute zero temperature is:", options: ["0°C", "-273.15°C", "-100°C", "0°F"], correctAnswer: 1 },
  { id: "phys-4", category: "Physics", subCategory: "Mechanics", difficulty: "EASY", type: "TRUE_FALSE", text: "Mass and weight are the same thing.", options: ["True", "False"], correctAnswer: 1 },
  { id: "phys-5", category: "Physics", subCategory: "Electricity", difficulty: "MEDIUM", type: "FILL_IN_THE_BLANKS", text: "The SI unit of resistance is ______.", options: [], correctAnswer: "Ohm" },
  { id: "phys-6", category: "Physics", subCategory: "Mechanics", difficulty: "MEDIUM", type: "MCQ", text: "Newton's second law of motion is given by:", options: ["F = ma", "F = m/a", "F = a/m", "F = m+a"], correctAnswer: 0 },
  { id: "phys-7", category: "Physics", subCategory: "Optics", difficulty: "EASY", type: "TRUE_FALSE", text: "Light travels in a straight line.", options: ["True", "False"], correctAnswer: 0 },
  { id: "phys-8", category: "Physics", subCategory: "Nuclear", difficulty: "HARD", type: "MCQ", text: "Which particle is responsible for the strong nuclear force?", options: ["Photon", "Gluon", "W boson", "Graviton"], correctAnswer: 1 },
  { id: "phys-9", category: "Physics", subCategory: "Mechanics", difficulty: "EASY", type: "FILL_IN_THE_BLANKS", text: "The rate of change of displacement is called ______.", options: [], correctAnswer: "Velocity" },
  { id: "phys-10", category: "Physics", subCategory: "Electricity", difficulty: "MEDIUM", type: "MCQ", text: "Which material is a good conductor of electricity?", options: ["Rubber", "Glass", "Copper", "Wood"], correctAnswer: 2 }
];

// --- Components ---

const AuthScreen = ({ onAuthSuccess }: { onAuthSuccess: (user: FirebaseUser) => void }) => {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'EMAIL' | 'OTP'>('EMAIL');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOtp = async () => {
    if (!email) return;
    setLoading(true);
    setError('');
    try {
      // In a real app, you'd call a backend to send an actual email
      const mockOtp = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(mockOtp);
      setStep('OTP');
      // Simulate email sending
      console.log(`[DEMO] OTP for ${email}: ${mockOtp}`);
      // Notify user about demo mode
      setError('DEMO MODE: In production, a real code will be sent to your email. For now, use: ' + mockOtp);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp !== generatedOtp) {
      setError('Invalid OTP. For demo, use the code shown in console or the one we "sent".');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // Use a deterministic password for this demo flow
      const dummyPassword = `OTP_AUTH_${email.split('@')[0]}_123`;
      let userCredential;
      try {
        userCredential = await signInWithEmailAndPassword(auth, email, dummyPassword);
      } catch (err: any) {
        if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
          userCredential = await createUserWithEmailAndPassword(auth, email, dummyPassword);
        } else {
          throw err;
        }
      }
      onAuthSuccess(userCredential.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f0] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-[40px] p-10 shadow-2xl border border-black/5"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-3xl font-serif font-medium mb-2">Welcome Back</h2>
          <p className="text-gray-500 text-sm">Verify your identity to continue</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        )}

        {step === 'EMAIL' ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input 
                  type="email" 
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  placeholder="name@example.com"
                />
              </div>
            </div>
            <button 
              onClick={handleSendOtp}
              disabled={loading || !email}
              className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-medium hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? 'Sending...' : 'Send Verification Code'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Verification Code</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input 
                  type="text" 
                  value={otp}
                  onChange={e => setOtp(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all text-center tracking-[0.5em] text-xl font-bold"
                  placeholder="000000"
                  maxLength={6}
                />
              </div>
              <p className="text-[10px] text-emerald-600 font-medium text-center mt-2">
                Demo Code: <span className="font-bold">{generatedOtp}</span>
              </p>
            </div>
            <button 
              onClick={handleVerifyOtp}
              disabled={loading || otp.length < 6}
              className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-medium hover:bg-emerald-700 transition-all disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify & Login'}
            </button>
            <button 
              onClick={() => setStep('EMAIL')}
              className="w-full text-sm text-gray-400 hover:text-gray-600 transition-all"
            >
              Change Email
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

const LoginPage = ({ onLogin }: { onLogin: (role: UserRole, student?: Student, examId?: string, invigilatorDescriptor?: Float32Array) => void }) => {
  const [role, setRole] = useState<UserRole>('STUDENT');
  const [name, setName] = useState('');
  const [roll, setRoll] = useState('');
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [step, setStep] = useState<'LOGIN' | 'INVIGILATOR'>('LOGIN');
  const [invigilatorDescriptor, setInvigilatorDescriptor] = useState<Float32Array | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [currentDeviceIndex, setCurrentDeviceIndex] = useState(0);

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(devices => {
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      setDevices(videoDevices);
    });
  }, []);

  useEffect(() => {
    if (role === 'STUDENT') {
      const q = query(collection(db, 'exams'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const examsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Exam));
        setExams(examsList);
      });
      return () => unsubscribe();
    }
  }, [role]);

  useEffect(() => {
    if (step === 'INVIGILATOR') {
      const loadModels = async () => {
        try {
          const MODEL_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';
          await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL)
          ]);
          setModelsLoaded(true);
          startVideo();
        } catch (err) {
          console.error("Model loading failed:", err);
          alert("Failed to load face detection models. Please check your internet connection.");
        }
      };
      loadModels();
    }
  }, [step]);

  const startVideo = () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Your browser does not support camera access.");
      return;
    }

    // Stop existing stream if any
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }

    const constraints: MediaStreamConstraints = {
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: "user"
      }
    };

    if (devices.length > 0) {
      (constraints.video as any).deviceId = { exact: devices[currentDeviceIndex].deviceId };
    }

    navigator.mediaDevices.getUserMedia(constraints)
    .then(stream => {
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(e => console.error("Video play failed:", e));
        };
      }
    })
    .catch(err => {
      console.error("Camera access error:", err);
      // If specific device fails, try generic
      if (devices.length > 0) {
        navigator.mediaDevices.getUserMedia({ video: true })
          .then(stream => {
            if (videoRef.current) videoRef.current.srcObject = stream;
          })
          .catch(e => console.error("Generic fallback failed:", e));
      }
      
      if (err.name === 'NotAllowedError') {
        alert("Camera access was denied. Please allow camera permissions in your browser settings.");
      } else if (err.name === 'NotFoundError') {
        alert("No camera found on this device.");
      } else {
        alert("Could not access camera: " + err.message);
      }
    });
  };

  const switchCamera = () => {
    if (devices.length < 2) return;
    const nextIndex = (currentDeviceIndex + 1) % devices.length;
    setCurrentDeviceIndex(nextIndex);
  };

  useEffect(() => {
    if (step === 'INVIGILATOR' && modelsLoaded) {
      startVideo();
    }
  }, [currentDeviceIndex, step, modelsLoaded]);

  const captureInvigilator = async () => {
    if (!videoRef.current || !modelsLoaded) {
      console.warn("Capture attempted before models loaded or video ready");
      return;
    }
    
    // Ensure video is actually playing and has dimensions
    if (videoRef.current.paused || videoRef.current.ended || videoRef.current.readyState < 2) {
      alert("Camera is not ready yet. Please wait a moment.");
      return;
    }

    setIsCapturing(true);
    try {
      console.log("Starting face detection...");
      // Use TinyFaceDetector as a fallback or for faster initial check if SSD is slow
      let detection = await faceapi.detectSingleFace(
        videoRef.current, 
        new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.5 })
      ).withFaceLandmarks().withFaceDescriptor();

      // If Tiny fails, try SSD for better accuracy
      if (!detection) {
        console.log("Tiny detector failed, trying SSD...");
        detection = await faceapi.detectSingleFace(
          videoRef.current, 
          new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 })
        ).withFaceLandmarks().withFaceDescriptor();
      }
      
      if (detection) {
        console.log("Face detected successfully");
        setInvigilatorDescriptor(detection.descriptor);
        alert("Invigilator registered successfully!");
      } else {
        console.warn("No face detected in frame");
        alert("No face detected. Please ensure your face is clearly visible, well-lit, and centered in the frame.");
      }
    } catch (err) {
      console.error("Capture error:", err);
      alert("An error occurred during face capture: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setIsCapturing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (role === 'TEACHER') {
      onLogin('TEACHER');
    } else if (name && roll && selectedExamId) {
      setStep('INVIGILATOR');
    }
  };

  if (step === 'INVIGILATOR') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f0] p-4">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md bg-white rounded-[32px] p-8 shadow-xl border border-black/5 text-center">
          <ScanFace className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
          <h2 className="text-2xl font-serif font-medium mb-2">Invigilator Registration</h2>
          <p className="text-gray-500 mb-6 text-sm">Please capture the invigilator's face to prevent false cheating alerts.</p>
          {devices.length > 1 && (
            <p className="text-xs text-emerald-600 font-medium mb-4">
              Multiple cameras detected. Use the switch button if you see a logo instead of your face.
            </p>
          )}
          <div className="aspect-video bg-black rounded-2xl overflow-hidden mb-6 relative">
            <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
            {!modelsLoaded && (
              <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white p-4">
                <RefreshCcw className="w-8 h-8 animate-spin mb-2" />
                <p className="text-sm font-medium">Loading AI Models...</p>
              </div>
            )}
            {isCapturing && <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-sm">Capturing...</div>}
            <div className="absolute top-2 right-2 flex gap-2">
              {devices.length > 1 && (
                <button 
                  onClick={switchCamera}
                  className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-all"
                  title="Switch Camera"
                >
                  <RefreshCcw className="w-4 h-4" />
                </button>
              )}
              <button 
                onClick={startVideo}
                className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-all"
                title="Refresh Camera"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={captureInvigilator} 
              disabled={isCapturing || !modelsLoaded} 
              className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-medium hover:bg-emerald-700 transition-all disabled:opacity-50"
            >
              {isCapturing ? "Processing..." : "Capture Face"}
            </button>
            <button 
              disabled={!invigilatorDescriptor} 
              onClick={() => onLogin('STUDENT', { name, rollNumber: roll }, selectedExamId, invigilatorDescriptor!)} 
              className="flex-1 bg-black text-white py-3 rounded-xl font-medium hover:bg-gray-800 transition-all disabled:opacity-30"
            >
              Start Exam
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f0] p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-[32px] p-8 shadow-xl border border-black/5"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mb-4">
            <ShieldCheck className="text-emerald-600 w-8 h-8" />
          </div>
          <h1 className="text-3xl font-serif font-medium text-gray-900">Smart AI Proctor</h1>
          <p className="text-gray-500 mt-2 text-center">Secure examination portal powered by AI</p>
        </div>

        <div className="flex p-1 bg-gray-100 rounded-2xl mb-8">
          <button 
            onClick={() => setRole('STUDENT')}
            className={cn(
              "flex-1 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2",
              role === 'STUDENT' ? "bg-white text-emerald-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            <GraduationCap className="w-4 h-4" />
            Student
          </button>
          <button 
            onClick={() => setRole('TEACHER')}
            className={cn(
              "flex-1 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2",
              role === 'TEACHER' ? "bg-white text-emerald-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            <LayoutDashboard className="w-4 h-4" />
            Teacher
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {role === 'STUDENT' ? (
            <>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 ml-1">Select Exam</label>
                <select
                  required
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  className="w-full px-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all outline-none appearance-none"
                >
                  <option value="">Choose an exam...</option>
                  {exams.map(exam => (
                    <option key={exam.id} value={exam.id}>{exam.title} ({exam.subject})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 ml-1">Student Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    required
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
                    placeholder="Enter your full name"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 ml-1">Roll Number</label>
                <div className="relative">
                  <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    required
                    type="text"
                    value={roll}
                    onChange={(e) => setRoll(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
                    placeholder="Enter your roll number"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 mb-4">
              <p className="text-sm text-emerald-700 text-center">
                Access the examiner dashboard to monitor student performance and integrity reports.
              </p>
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-4 rounded-2xl transition-all flex items-center justify-center gap-2 group"
          >
            {role === 'STUDENT' ? 'Start Exam' : 'Enter Dashboard'}
            <Play className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Trust & Security</p>
          <p className="text-sm font-medium text-gray-900 mt-1">The safest anti-cheating app developed by Atharv Choudhari</p>
        </div>
      </motion.div>
    </div>
  );
};

const ExamBuilder = ({ onSave, onCancel }: { onSave: (exam: Partial<Exam>) => void, onCancel: () => void }) => {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [type, setType] = useState<'MIXED' | 'MCQ' | 'TRUE_FALSE'>('MIXED');
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleOptions, setShuffleOptions] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([
    { id: '1', type: 'MCQ', text: '', options: ['', '', '', ''], correctAnswer: 0 }
  ]);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isUrlModalOpen, setIsUrlModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importUrl, setImportUrl] = useState('');
  const [isUrlLoading, setIsUrlLoading] = useState(false);

  const handleImport = () => {
    try {
      const imported = JSON.parse(importText);
      if (Array.isArray(imported)) {
        setQuestions([...questions, ...imported.map(q => ({
          ...q,
          id: q.id || Date.now().toString() + Math.random(),
          type: q.type || 'MCQ',
          options: q.options || (q.type === 'TRUE_FALSE' ? ['True', 'False'] : []),
          correctAnswer: q.correctAnswer ?? (q.type === 'FILL_IN_THE_BLANKS' ? '' : 0)
        }))]);
        setIsImportModalOpen(false);
        setImportText('');
      }
    } catch (e) {
      alert('Invalid JSON format. Please provide an array of question objects.');
    }
  };

  const handleUrlImport = async () => {
    if (!importUrl) return;
    setIsUrlLoading(true);
    try {
      const response = await fetch(`/api/proxy?url=${encodeURIComponent(importUrl)}`);
      const text = await response.text();
      
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const model = "gemini-3-flash-preview";
      
      const prompt = `Extract questions from the following text and return them as a JSON array of objects. 
      Each object must have:
      - text (string)
      - type (string: "MCQ", "TRUE_FALSE", or "FILL_IN_THE_BLANKS")
      - options (array of strings, empty for FILL_IN_THE_BLANKS)
      - correctAnswer (number index for MCQ/TF, string for FIB)
      - difficulty (string: "EASY", "MEDIUM", or "HARD")
      - category (string)
      - subCategory (string)

      Text:
      ${text.substring(0, 10000)} // Limit text size
      `;

      const result = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING },
                type: { type: Type.STRING, enum: ["MCQ", "TRUE_FALSE", "FILL_IN_THE_BLANKS"] },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctAnswer: { type: Type.STRING }, // Use string to handle both index and text
                difficulty: { type: Type.STRING, enum: ["EASY", "MEDIUM", "HARD"] },
                category: { type: Type.STRING },
                subCategory: { type: Type.STRING }
              },
              required: ["text", "type", "correctAnswer"]
            }
          }
        }
      });

      const extracted = JSON.parse(result.text || "[]");
      if (extracted.length > 0) {
        setQuestions([...questions, ...extracted.map((q: any) => ({
          ...q,
          id: Date.now().toString() + Math.random(),
          correctAnswer: q.type === 'FILL_IN_THE_BLANKS' ? q.correctAnswer : parseInt(q.correctAnswer)
        }))]);
        setIsUrlModalOpen(false);
        setImportUrl('');
      } else {
        alert("No questions could be extracted from this URL.");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to import from URL. Make sure the URL is accessible and contains question-like content.");
    } finally {
      setIsUrlLoading(false);
    }
  };

  // Bank filters
  const [bankCategory, setBankCategory] = useState<string>('Physics');
  const [bankDifficulty, setBankDifficulty] = useState<'EASY' | 'MEDIUM' | 'HARD' | 'ALL'>('ALL');

  const categories = Array.from(new Set(GLOBAL_QUESTION_BANK.map(q => q.category)));
  
  // Auto-filter bank by subject if subject changes
  useEffect(() => {
    if (subject) {
      const matchingCategory = categories.find(c => c.toLowerCase().includes(subject.toLowerCase()));
      if (matchingCategory) setBankCategory(matchingCategory);
    }
  }, [subject]);

  const filteredBank = GLOBAL_QUESTION_BANK.filter(q => 
    (q.category === bankCategory || q.subCategory?.toLowerCase().includes(subject.toLowerCase())) && 
    (bankDifficulty === 'ALL' || q.difficulty === bankDifficulty)
  );

  const addQuestion = (qType: QuestionType = 'MCQ') => {
    setQuestions([...questions, { 
      id: Date.now().toString(), 
      type: qType,
      text: '', 
      options: qType === 'TRUE_FALSE' ? ['True', 'False'] : qType === 'MCQ' ? ['', '', '', ''] : [], 
      correctAnswer: qType === 'FILL_IN_THE_BLANKS' ? '' : 0 
    }]);
  };

  const importQuestion = (q: Question) => {
    setQuestions([...questions, { ...q, id: Date.now().toString() + Math.random() }]);
    if (!subject) setSubject(q.subCategory || q.category || '');
  };

  const updateQuestion = (index: number, field: keyof Question, value: any) => {
    const newQuestions = [...questions];
    newQuestions[index] = { ...newQuestions[index], [field]: value };
    setQuestions(newQuestions);
  };

  const updateOption = (qIndex: number, oIndex: number, value: string) => {
    const newQuestions = [...questions];
    newQuestions[qIndex].options[oIndex] = value;
    setQuestions(newQuestions);
  };

  return (
    <div className="min-h-screen bg-[#f5f5f0] p-8">
      <div className="max-w-6xl mx-auto bg-white rounded-[40px] p-12 shadow-xl border border-black/5">
        <div className="flex justify-between items-center mb-12">
          <h2 className="text-3xl font-serif font-medium">Create New Exam</h2>
          <div className="flex gap-4">
            <button 
              onClick={() => setIsUrlModalOpen(true)}
              className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-emerald-100 transition-all flex items-center gap-2 border border-emerald-100"
            >
              <ExternalLink className="w-4 h-4" />
              Import from URL
            </button>
            <button 
              onClick={() => setIsImportModalOpen(true)}
              className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-gray-200 transition-all flex items-center gap-2"
            >
              <Share2 className="w-4 h-4" />
              Import JSON
            </button>
            <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><XCircle /></button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Exam Title</label>
              <input value={title} onChange={e => setTitle(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl outline-none border border-transparent focus:border-emerald-500/20 transition-all" placeholder="e.g. Midterm Physics" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Subject</label>
              <input value={subject} onChange={e => setSubject(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl outline-none border border-transparent focus:border-emerald-500/20 transition-all" placeholder="e.g. Science" />
            </div>
          </div>

          <div className="bg-emerald-50/50 p-8 rounded-[32px] border border-emerald-100">
            <h3 className="text-sm font-bold text-emerald-800 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Search className="w-4 h-4" />
              Global Question Bank
            </h3>
            
            <div className="flex flex-wrap gap-2 mb-6">
              {categories.map(c => (
                <button 
                  key={c}
                  onClick={() => setBankCategory(c || '')}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all border",
                    bankCategory === c ? "bg-emerald-600 border-emerald-600 text-white" : "bg-white border-emerald-100 text-emerald-600 hover:bg-emerald-50"
                  )}
                >
                  {c}
                </button>
              ))}
            </div>

            <div className="flex gap-2 mb-6">
              {(['ALL', 'EASY', 'MEDIUM', 'HARD'] as const).map(d => (
                <button 
                  key={d}
                  onClick={() => setBankDifficulty(d)}
                  className={cn(
                    "flex-1 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border",
                    bankDifficulty === d ? "bg-emerald-800 border-emerald-800 text-white" : "bg-white border-emerald-100 text-emerald-800 hover:bg-emerald-50"
                  )}
                >
                  {d}
                </button>
              ))}
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {filteredBank.length === 0 ? (
                <p className="text-xs text-gray-400 italic text-center py-8">No questions found for this filter.</p>
              ) : (
                filteredBank.map(q => (
                  <button 
                    key={q.id}
                    onClick={() => importQuestion(q)}
                    className="w-full text-left p-4 bg-white border border-emerald-100 rounded-2xl hover:border-emerald-400 hover:shadow-md transition-all group"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest">{q.subCategory}</span>
                      <span className={cn(
                        "text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest",
                        q.difficulty === 'EASY' ? "bg-emerald-50 text-emerald-600" :
                        q.difficulty === 'MEDIUM' ? "bg-orange-50 text-orange-600" : "bg-red-50 text-red-600"
                      )}>{q.difficulty}</span>
                    </div>
                    <p className="text-xs text-gray-700 font-medium line-clamp-2 group-hover:text-emerald-900">{q.text}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="mb-12 flex items-center gap-6 p-4 bg-gray-50 rounded-2xl">
          <div className="flex items-center gap-3">
            <input 
              type="checkbox" 
              id="shuffle" 
              checked={shuffleQuestions} 
              onChange={e => setShuffleQuestions(e.target.checked)}
              className="w-5 h-5 accent-emerald-600"
            />
            <label htmlFor="shuffle" className="text-sm font-medium text-gray-700 cursor-pointer flex items-center gap-2">
              <Move className="w-4 h-4 text-gray-400" />
              Shuffle questions
            </label>
          </div>
          <div className="flex items-center gap-3">
            <input 
              type="checkbox" 
              id="shuffleOptions" 
              checked={shuffleOptions} 
              onChange={e => setShuffleOptions(e.target.checked)}
              className="w-5 h-5 accent-emerald-600"
            />
            <label htmlFor="shuffleOptions" className="text-sm font-medium text-gray-700 cursor-pointer flex items-center gap-2">
              <RefreshCcw className="w-4 h-4 text-gray-400" />
              Shuffle options
            </label>
          </div>
        </div>

        <div className="space-y-8">
          {questions.map((q, qIdx) => (
            <div key={q.id} className="p-8 bg-gray-50 rounded-[32px] space-y-6 relative group">
              <button 
                onClick={() => setQuestions(questions.filter((_, i) => i !== qIdx))}
                className="absolute top-4 right-4 text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
              >
                <XCircle className="w-5 h-5" />
              </button>
              
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-bold text-emerald-600">Question {qIdx + 1}</span>
                  <select 
                    value={q.type}
                    onChange={(e) => {
                      const newType = e.target.value as QuestionType;
                      updateQuestion(qIdx, 'type', newType);
                      if (newType === 'TRUE_FALSE') {
                        updateQuestion(qIdx, 'options', ['True', 'False']);
                        updateQuestion(qIdx, 'correctAnswer', 0);
                      } else if (newType === 'FILL_IN_THE_BLANKS') {
                        updateQuestion(qIdx, 'options', []);
                        updateQuestion(qIdx, 'correctAnswer', '');
                      } else {
                        updateQuestion(qIdx, 'options', ['', '', '', '']);
                        updateQuestion(qIdx, 'correctAnswer', 0);
                      }
                    }}
                    className="bg-white border border-gray-200 rounded-lg px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-gray-500 outline-none"
                  >
                    <option value="MCQ">Multiple Choice</option>
                    <option value="TRUE_FALSE">True / False</option>
                    <option value="FILL_IN_THE_BLANKS">Fill in Blanks</option>
                  </select>
                </div>
              </div>

              <input 
                value={q.text} 
                onChange={e => updateQuestion(qIdx, 'text', e.target.value)}
                className="w-full p-4 bg-white rounded-xl outline-none border border-gray-100" 
                placeholder={q.type === 'FILL_IN_THE_BLANKS' ? "Use ______ for the blank space..." : "Enter question text..."} 
              />

              {q.type === 'FILL_IN_THE_BLANKS' ? (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Correct Answer</label>
                  <input 
                    value={q.correctAnswer as string}
                    onChange={e => updateQuestion(qIdx, 'correctAnswer', e.target.value)}
                    className="w-full p-4 bg-white rounded-xl outline-none border border-gray-100 text-sm"
                    placeholder="Enter the correct word or phrase"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {q.options.map((opt, oIdx) => (
                    <div key={oIdx} className="flex items-center gap-3">
                      <input 
                        type="radio" 
                        checked={q.correctAnswer === oIdx} 
                        onChange={() => updateQuestion(qIdx, 'correctAnswer', oIdx)}
                        className="accent-emerald-600"
                      />
                      <input 
                        value={opt} 
                        onChange={e => updateOption(qIdx, oIdx, e.target.value)}
                        className="flex-1 p-3 bg-white rounded-xl outline-none border border-gray-100 text-sm" 
                        placeholder={`Option ${oIdx + 1}`} 
                        disabled={q.type === 'TRUE_FALSE'}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col md:flex-row gap-4">
          <div className="flex-1 flex gap-2">
            <button onClick={() => addQuestion('MCQ')} className="flex-1 py-4 rounded-2xl border-2 border-dashed border-gray-200 text-gray-400 text-xs font-bold uppercase tracking-widest hover:border-emerald-200 hover:text-emerald-600 transition-all">
              + MCQ
            </button>
            <button onClick={() => addQuestion('TRUE_FALSE')} className="flex-1 py-4 rounded-2xl border-2 border-dashed border-gray-200 text-gray-400 text-xs font-bold uppercase tracking-widest hover:border-emerald-200 hover:text-emerald-600 transition-all">
              + T/F
            </button>
            <button onClick={() => addQuestion('FILL_IN_THE_BLANKS')} className="flex-1 py-4 rounded-2xl border-2 border-dashed border-gray-200 text-gray-400 text-xs font-bold uppercase tracking-widest hover:border-emerald-200 hover:text-emerald-600 transition-all">
              + FIB
            </button>
          </div>
          <button 
            onClick={() => onSave({ title, subject, type, questions, shuffleQuestions, shuffleOptions })}
            className="flex-1 py-4 rounded-2xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-all"
          >
            Save Exam
          </button>
        </div>

        {/* Import Modal */}
        <AnimatePresence>
          {isImportModalOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-[40px] p-10 w-full max-w-2xl shadow-2xl border border-black/5"
              >
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-2xl font-serif font-medium">Import Questions</h3>
                  <button onClick={() => setIsImportModalOpen(false)} className="text-gray-400 hover:text-gray-600"><XCircle /></button>
                </div>
                <p className="text-sm text-gray-500 mb-6">Paste a JSON array of question objects. Example: <code className="bg-gray-100 px-2 py-1 rounded">{'[{"text": "...", "type": "MCQ", "options": ["...", "..."], "correctAnswer": 0}]'}</code></p>
                <textarea 
                  value={importText}
                  onChange={e => setImportText(e.target.value)}
                  className="w-full h-64 p-6 bg-gray-50 rounded-3xl outline-none border border-gray-100 font-mono text-xs mb-8"
                  placeholder='[{"text": "Is AI safe?", "type": "TRUE_FALSE", "options": ["True", "False"], "correctAnswer": 0}]'
                />
                <div className="flex gap-4">
                  <button onClick={() => setIsImportModalOpen(false)} className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-medium hover:bg-gray-200 transition-all">Cancel</button>
                  <button onClick={handleImport} className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-medium hover:bg-emerald-700 transition-all">Import Questions</button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* URL Import Modal */}
        <AnimatePresence>
          {isUrlModalOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-[40px] p-10 w-full max-w-xl shadow-2xl border border-black/5"
              >
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-2xl font-serif font-medium">Import from Website</h3>
                  <button onClick={() => setIsUrlModalOpen(false)} className="text-gray-400 hover:text-gray-600"><XCircle /></button>
                </div>
                <p className="text-sm text-gray-500 mb-6">Enter a URL of a page containing questions. Our AI will attempt to extract them for you.</p>
                <div className="relative mb-8">
                  <ExternalLink className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input 
                    type="url"
                    value={importUrl}
                    onChange={e => setImportUrl(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 rounded-2xl outline-none border border-gray-100 focus:border-emerald-500/20 transition-all"
                    placeholder="https://example.com/quiz"
                  />
                </div>
                <div className="flex gap-4">
                  <button onClick={() => setIsUrlModalOpen(false)} className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-medium hover:bg-gray-200 transition-all">Cancel</button>
                  <button 
                    onClick={handleUrlImport} 
                    disabled={isUrlLoading || !importUrl}
                    className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-medium hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isUrlLoading ? (
                      <>
                        <RefreshCcw className="w-4 h-4 animate-spin" />
                        Extracting...
                      </>
                    ) : "Extract Questions"}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const FeedbackModal = ({ isOpen, onClose, user }: { isOpen: boolean, onClose: () => void, user: FirebaseUser }) => {
  const [type, setType] = useState<'ISSUE' | 'SUGGESTION' | 'OTHER'>('ISSUE');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!message) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'feedback'), {
        userId: user.uid,
        userEmail: user.email,
        userName: user.displayName || user.email?.split('@')[0],
        type,
        message,
        createdAt: Date.now()
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setMessage('');
        onClose();
      }, 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-lg rounded-[32px] overflow-hidden shadow-2xl"
      >
        <div className="p-8">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-2xl font-serif font-medium">Feedback & Support</h3>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <XCircle className="w-6 h-6 text-gray-400" />
            </button>
          </div>

          {success ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h4 className="text-xl font-medium text-gray-900">Thank You!</h4>
              <p className="text-gray-500 mt-2">Your feedback helps us improve the platform.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex gap-2">
                {(['ISSUE', 'SUGGESTION', 'OTHER'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={cn(
                      "flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-widest border transition-all",
                      type === t ? "bg-emerald-600 border-emerald-600 text-white" : "bg-white border-gray-200 text-gray-400 hover:border-emerald-200"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe the issue or share your suggestion..."
                className="w-full h-40 p-4 bg-gray-50 rounded-2xl outline-none border border-transparent focus:border-emerald-500/20 focus:ring-4 focus:ring-emerald-500/5 transition-all resize-none"
              />

              <button
                onClick={handleSubmit}
                disabled={loading || !message}
                className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? "Sending..." : "Submit Feedback"}
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const TeacherDashboard = ({ onLogout }: { onLogout: () => void }) => {
  const [reports, setReports] = useState<ExamReport[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [feedback, setFeedback] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'CLEAN' | 'SUSPICIOUS' | 'CHEATING'>('ALL');
  const [showBuilder, setShowBuilder] = useState(false);
  const [activeTab, setActiveTab] = useState<'REPORTS' | 'EXAMS' | 'FEEDBACK'>('REPORTS');

  useEffect(() => {
    const qReports = query(collection(db, 'reports'));
    const qExams = query(collection(db, 'exams'));
    const qFeedback = query(collection(db, 'feedback'));
    
    const unsubReports = onSnapshot(qReports, (snapshot) => {
      setReports(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
      setLoading(false);
    });

    const unsubExams = onSnapshot(qExams, (snapshot) => {
      setExams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
    });

    const unsubFeedback = onSnapshot(qFeedback, (snapshot) => {
      setFeedback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)).sort((a, b) => b.createdAt - a.createdAt));
    });

    return () => {
      unsubReports();
      unsubExams();
      unsubFeedback();
    };
  }, []);

  const handleSaveExam = async (examData: Partial<Exam>) => {
    try {
      await addDoc(collection(db, 'exams'), {
        ...examData,
        creatorUid: auth.currentUser?.uid,
        createdAt: Date.now()
      });
      setShowBuilder(false);
    } catch (err) {
      console.error(err);
    }
  };

  if (showBuilder) return <ExamBuilder onSave={handleSaveExam} onCancel={() => setShowBuilder(false)} />;

  const filteredReports = reports.filter(r => {
    const matchesSearch = r.student.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         r.student.rollNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'ALL' || r.status === filter;
    return matchesSearch && matchesFilter;
  });

  const filteredExams = exams.filter(e => 
    e.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.subject.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#f5f5f0] p-8">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div>
            <h1 className="text-3xl md:text-4xl font-serif font-medium text-gray-900">Examiner Dashboard</h1>
            <p className="text-gray-500 mt-1">Monitor exam integrity and student violations</p>
          </div>
          <div className="flex gap-4 w-full md:w-auto">
            <button 
              onClick={() => setShowBuilder(true)}
              className="flex-1 md:flex-none bg-emerald-600 text-white px-6 py-3 md:py-2 rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors"
            >
              Create Exam
            </button>
            <button 
              onClick={onLogout}
              className="flex-1 md:flex-none bg-white border border-gray-200 px-6 py-3 md:py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Logout
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-black/5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Total Exams</p>
            <p className="text-3xl font-serif">{reports.length}</p>
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-black/5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Cheating Detected</p>
            <p className="text-3xl font-serif text-red-600">{reports.filter(r => r.status === 'CHEATING').length}</p>
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-black/5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Suspicious Cases</p>
            <p className="text-3xl font-serif text-orange-600">{reports.filter(r => r.status === 'SUSPICIOUS').length}</p>
          </div>
        </div>

        <div className="bg-white rounded-[32px] shadow-sm border border-black/5 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row gap-4 justify-between items-center">
            <div className="flex gap-4">
              {(['REPORTS', 'EXAMS', 'FEEDBACK'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-medium transition-all",
                    activeTab === tab ? "bg-emerald-600 text-white" : "text-gray-500 hover:bg-gray-50"
                  )}
                >
                  {tab.charAt(0) + tab.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
            <div className="relative w-full md:w-96">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder={activeTab === 'REPORTS' ? "Search by name or roll number..." : activeTab === 'EXAMS' ? "Search by title or subject..." : "Search feedback..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-gray-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
            </div>
            <div className="flex gap-2">
              {(['ALL', 'CLEAN', 'SUSPICIOUS', 'CHEATING'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
                    filter === f ? "bg-black text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            {activeTab === 'REPORTS' ? (
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/50">
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Student</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Violations</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Duration</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">Loading reports...</td></tr>
                  ) : filteredReports.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">No reports found.</td></tr>
                  ) : (
                    filteredReports.map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-medium text-gray-900">{r.student.name}</p>
                          <p className="text-xs text-gray-400">{r.student.rollNumber}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                            r.status === 'CLEAN' ? "bg-emerald-50 text-emerald-600" :
                            r.status === 'SUSPICIOUS' ? "bg-orange-50 text-orange-600" :
                            "bg-red-50 text-red-600"
                          )}>
                            {r.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className={cn("w-4 h-4", r.violations.length > 0 ? "text-orange-400" : "text-gray-200")} />
                            <span className="text-sm font-medium">{r.violations.length}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {Math.floor((r.endTime - r.startTime) / 1000)}s
                        </td>
                        <td className="px-6 py-4">
                          <button className="text-emerald-600 hover:text-emerald-700 font-medium text-sm flex items-center gap-1">
                            View Details <ArrowRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : activeTab === 'EXAMS' ? (
              <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredExams.length === 0 ? (
                  <div className="col-span-full text-center py-12 text-gray-400 italic">No exams found matching your search.</div>
                ) : (
                  filteredExams.map((exam) => (
                    <div key={exam.id} className="p-6 bg-gray-50 rounded-3xl border border-gray-100 hover:border-emerald-200 transition-all group">
                      <div className="flex justify-between items-start mb-4">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                          <GraduationCap className="w-5 h-5 text-emerald-600" />
                        </div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{exam.subject}</span>
                      </div>
                      <h4 className="text-lg font-serif font-medium mb-1">{exam.title}</h4>
                      <p className="text-xs text-gray-500 mb-6">{exam.questions.length} Questions • {exam.type}</p>
                      <div className="flex gap-2">
                        <button className="flex-1 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium hover:bg-gray-50 transition-all">Edit</button>
                        <button className="flex-1 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium hover:text-red-600 hover:border-red-100 transition-all">Delete</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="p-8 space-y-4">
                {feedback.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 italic">No feedback received yet.</div>
                ) : (
                  feedback.map((f) => (
                    <div key={f.id} className="p-6 bg-gray-50 rounded-3xl border border-gray-100">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-xs font-bold text-gray-400">
                            {f.userName?.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{f.userName}</p>
                            <p className="text-[10px] text-gray-400">{f.userEmail}</p>
                          </div>
                        </div>
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                          f.type === 'ISSUE' ? "bg-red-50 text-red-600" :
                          f.type === 'SUGGESTION' ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"
                        )}>
                          {f.type}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed">{f.message}</p>
                      <p className="text-[10px] text-gray-400 mt-4">{new Date(f.createdAt).toLocaleString()}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-200 text-center">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Trust & Security</p>
          <p className="text-sm font-medium text-gray-900 mt-1">The safest anti-cheating app</p>
        </div>
      </div>
    </div>
  );
};

const ExamPage = ({ student, exam, onComplete, invigilatorDescriptor }: { student: Student, exam: Exam, onComplete: (report: ExamReport) => void, invigilatorDescriptor: Float32Array }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [faceLandmarker, setFaceLandmarker] = useState<FaceLandmarker | null>(null);
  const [status, setStatus] = useState<string>("Initializing AI...");
  const [timeLeft, setTimeLeft] = useState(3600); // 60 minutes in seconds

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 0) {
          clearInterval(timer);
          finishExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };
  const [warnings, setWarnings] = useState<number>(0);
  const [violations, setViolations] = useState<ExamViolation[]>([]);
  const [isLookingAway, setIsLookingAway] = useState(false);
  const lookAwayStartTime = useRef<number | null>(null);
  const [examStartedAt] = useState(Date.now());
  const [currentQuestion, setCurrentQuestion] = useState(0);
  
  // Shuffling logic
  const [questions] = useState(() => {
    let qList = [...exam.questions];
    if (exam.shuffleQuestions) {
      qList.sort(() => Math.random() - 0.5);
    }
    if (exam.shuffleOptions) {
      qList = qList.map(q => {
        const originalCorrectOption = q.options[q.correctAnswer];
        const shuffledOptions = [...q.options].sort(() => Math.random() - 0.5);
        const newCorrectAnswer = shuffledOptions.indexOf(originalCorrectOption);
        return { ...q, options: shuffledOptions, correctAnswer: newCorrectAnswer };
      });
    }
    return qList;
  });

  const [answers, setAnswers] = useState<(number | string)[]>(new Array(questions.length).fill(-1));
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [currentDeviceIndex, setCurrentDeviceIndex] = useState(0);

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(devices => {
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      setDevices(videoDevices);
    });
  }, []);

  // Gaze tracking state
  const gazeStartTime = useRef<number | null>(null);
  const [gazeDirection, setGazeDirection] = useState<{ x: number, y: number } | null>(null);

  // Movement & Lighting detection state
  const lastFacePos = useRef<{ x: number, y: number } | null>(null);
  const movementWarningCooldown = useRef<number>(0);
  const lastBrightness = useRef<number | null>(null);
  const lightingWarningCooldown = useRef<number>(0);

  // Initialize MediaPipe
  useEffect(() => {
    const initAI = async () => {
      try {
        const filesetResolver = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        const landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: "GPU"
          },
          outputFaceBlendshapes: true,
          runningMode: "VIDEO",
          numFaces: 2
        });
        setFaceLandmarker(landmarker);
        setStatus("Exam Running");
      } catch (err) {
        console.error(err);
        setStatus("Failed to load AI models");
      }
    };
    initAI();
  }, []);

  // Setup Camera
  useEffect(() => {
    if (!videoRef.current) return;

    // Stop existing stream if any
    if (videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }

    const constraints: MediaStreamConstraints = {
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: "user"
      }
    };

    if (devices.length > 0) {
      (constraints.video as any).deviceId = { exact: devices[currentDeviceIndex].deviceId };
    }

    navigator.mediaDevices.getUserMedia(constraints)
    .then((stream) => {
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(e => console.error("Exam video play failed:", e));
        };
      }
    })
    .catch(err => {
      console.error("Exam camera access error:", err);
      // If specific device fails, try generic
      if (devices.length > 0) {
        navigator.mediaDevices.getUserMedia({ video: true })
          .then(stream => {
            if (videoRef.current) videoRef.current.srcObject = stream;
          })
          .catch(e => console.error("Generic fallback failed:", e));
      }
      setStatus("Camera Access Denied");
    });
  }, [currentDeviceIndex, devices.length]);

  const switchCamera = () => {
    if (devices.length < 2) return;
    const nextIndex = (currentDeviceIndex + 1) % devices.length;
    setCurrentDeviceIndex(nextIndex);
  };

  // Tab Switching Detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        addViolation('TAB_SWITCH', 'Tab switch or potential screen search tool detected');
        setStatus("Warning - Tab Switch");
      }
    };
    const handleBlur = () => {
      addViolation('TAB_SWITCH', 'Window focus lost - potential screen search tool use');
      setStatus("Warning - Focus Lost");
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [warnings]);

  const addViolation = (type: ExamViolation['type'], message: string) => {
    const timestamp = Date.now();
    setViolations(prev => [...prev, { type, message, timestamp }]);
    setWarnings(prev => prev + 1);
  };

  useEffect(() => {
    if (warnings >= WARNING_THRESHOLD) {
      // Use a small timeout or ensure this doesn't run during render
      const timer = setTimeout(() => {
        finishExam(warnings);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [warnings]);

  const finishExam = (finalWarnings?: number) => {
    const actualWarnings = finalWarnings ?? warnings;
    const report: ExamReport = {
      student,
      examId: exam.id,
      examTitle: exam.title,
      violations,
      totalWarnings: actualWarnings,
      status: actualWarnings === 0 ? 'CLEAN' : actualWarnings < 3 ? 'SUSPICIOUS' : 'CHEATING',
      answers,
      startTime: examStartedAt,
      endTime: Date.now(),
      questions // Include the questions (potentially shuffled) in the report
    };
    
    // Stop camera
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    }
    
    onComplete(report);
  };

  // AI Loop
  useEffect(() => {
    let animationId: number;
    const runAI = () => {
      if (faceLandmarker && videoRef.current && videoRef.current.readyState >= 2) {
        const results = faceLandmarker.detectForVideo(videoRef.current, performance.now());
        processResults(results);
      }
      animationId = requestAnimationFrame(runAI);
    };
    runAI();
    return () => cancelAnimationFrame(animationId);
  }, [faceLandmarker, isLookingAway, warnings]);

  const lastMultiFaceCheck = useRef<number>(0);

  const processResults = async (results: FaceLandmarkerResult) => {
    const faces = results.faceLandmarks;
    
    // 1. Multiple Faces with Invigilator Check
    if (faces.length > 1) {
      // Throttle heavy face-api check to once every 2 seconds
      if (Date.now() - lastMultiFaceCheck.current > 2000) {
        lastMultiFaceCheck.current = Date.now();
        if (videoRef.current) {
          const detections = await faceapi.detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptors();
          const faceMatcher = new faceapi.FaceMatcher(invigilatorDescriptor);
          const hasInvigilator = detections.some(d => faceMatcher.findBestMatch(d.descriptor).label !== 'unknown');
          
          if (!hasInvigilator) {
            setStatus("Cheating Detected - Multiple Faces");
            addViolation('MULTIPLE_FACES', 'Multiple faces detected in frame');
            return;
          }
        }
      }
    }

    // 2. Face Not Found
    if (faces.length === 0) {
      setStatus("Face Not Found");
      return;
    }

    const landmarks = faces[0];
    const nose = landmarks[1];

    // 3. Gaze Tracking
    // Left eye: 33, 133, 160, 158, 153, 144
    // Right eye: 263, 362, 387, 385, 380, 373
    // Iris: 468 (Left), 473 (Right) - if using iris model, but we use face_landmarker
    // We can estimate gaze by looking at the pupil position relative to eye corners
    const leftEyeCenter = landmarks[468] || landmarks[33]; // Fallback to corner if iris not available
    const rightEyeCenter = landmarks[473] || landmarks[263];
    
    // Simple gaze estimation: if nose is centered but eyes are looking away
    // For visualization, we'll draw a line from the eyes
    setGazeDirection({ x: (leftEyeCenter.x + rightEyeCenter.x) / 2, y: (leftEyeCenter.y + rightEyeCenter.y) / 2 });

    // Gaze deviation logic (simplified: if head is turned or eyes are off-center)
    const leftEye = landmarks[33];
    const rightEye = landmarks[263];
    const eyeMidX = (leftEye.x + rightEye.x) / 2;
    const eyeMidY = (leftEye.y + rightEye.y) / 2;
    const gazeX = nose.x - eyeMidX;
    const gazeY = nose.y - eyeMidY;

    const gazeDeviated = Math.abs(gazeX) > 0.45 || Math.abs(gazeY) > 0.35;

    if (gazeDeviated) {
      if (!gazeStartTime.current) gazeStartTime.current = Date.now();
      if (Date.now() - gazeStartTime.current > 5000) {
        setStatus("Warning - Gaze Deviation");
        addViolation('GAZE_DEVIATION', 'Gaze deviated from screen for > 5s');
        gazeStartTime.current = null;
      }
    } else {
      gazeStartTime.current = null;
    }

    // 4. Movement Detection (Seating Position Change)
    
    if (lastFacePos.current) {
      const dx = Math.abs(nose.x - lastFacePos.current.x);
      const dy = Math.abs(nose.y - lastFacePos.current.y);
      
      if ((dx > MOVEMENT_THRESHOLD || dy > MOVEMENT_THRESHOLD) && Date.now() > movementWarningCooldown.current) {
        setStatus("Warning - Significant Movement");
        addViolation('SIGNIFICANT_MOVEMENT', 'Frequent seating position changes detected');
        movementWarningCooldown.current = Date.now() + 10000;
      }
    }
    lastFacePos.current = { x: nose.x, y: nose.y };

    // 4. Lighting Change Detection (Background Anomaly)
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = 100; // Small size for performance
        canvas.height = 100;
        ctx.drawImage(videoRef.current, 0, 0, 100, 100);
        const imageData = ctx.getImageData(0, 0, 100, 100);
        let totalBrightness = 0;
        for (let i = 0; i < imageData.data.length; i += 4) {
          totalBrightness += (imageData.data[i] + imageData.data[i+1] + imageData.data[i+2]) / 3;
        }
        const avgBrightness = totalBrightness / (100 * 100);
        
        if (lastBrightness.current !== null) {
          const diff = Math.abs(avgBrightness - lastBrightness.current);
          if (diff > 40 && Date.now() > lightingWarningCooldown.current) { // Significant lighting change
            setStatus("Warning - Lighting Change");
            addViolation('POSITION_CHANGE', 'Sudden lighting or background change detected');
            lightingWarningCooldown.current = Date.now() + 15000;
          }
        }
        lastBrightness.current = avgBrightness;
      }
    }

    // 5. Head Pose Estimation (Looking Away)
    // 33: Left eye, 263: Right eye
    // Reuse eye positions from gaze tracking section
    const yaw = nose.x - eyeMidX;
    const pitch = nose.y - eyeMidY;

    const lookingAway = Math.abs(yaw) > YAW_THRESHOLD || Math.abs(pitch) > PITCH_THRESHOLD;

    if (lookingAway) {
      setStatus("Warning - Looking Away");
      if (!lookAwayStartTime.current) {
        lookAwayStartTime.current = Date.now();
      } else if (Date.now() - lookAwayStartTime.current > LOOK_AWAY_TIME_THRESHOLD) {
        addViolation('LOOKING_AWAY', 'Looking away from screen for too long');
        lookAwayStartTime.current = null; // Reset after warning
      }
      setIsLookingAway(true);
    } else {
      if (status !== "Warning - Significant Movement") {
        setStatus("Exam Running");
      }
      lookAwayStartTime.current = null;
      setIsLookingAway(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col font-sans selection:bg-emerald-500/30">
      {/* Header - Technical/Minimal */}
      <header className="bg-black/40 backdrop-blur-xl border-b border-white/5 px-8 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20">
              <ShieldCheck className="text-emerald-500 w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif font-medium text-lg tracking-tight">{exam.title}</h2>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-emerald-500/60 uppercase tracking-widest">Live Session</span>
                <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
              </div>
            </div>
          </div>
          
          <div className="h-8 w-px bg-white/10 hidden md:block" />
          
          <div className="hidden md:flex items-center gap-4">
            <div className="flex flex-col">
              <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Candidate</span>
              <span className="text-sm font-medium">{student.name}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">ID</span>
              <span className="text-sm font-mono text-white/60">{student.rollNumber}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-8">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Time Remaining</span>
            <span className={cn(
              "text-2xl font-mono font-medium tracking-tighter",
              timeLeft < 300 ? "text-red-500 animate-pulse" : "text-white"
            )}>
              {formatTime(timeLeft)}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 rounded-xl border border-red-500/20">
              <AlertTriangle className="text-red-500 w-4 h-4" />
              <span className="text-xs font-mono font-bold text-red-500">{warnings}/3</span>
            </div>
            <button 
              onClick={() => finishExam()}
              className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
            >
              Submit
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0">
        {/* Left: Questions Area - Clean & Focused */}
        <div className="lg:col-span-8 p-8 lg:p-12 overflow-y-auto custom-scrollbar bg-[#0f0f0f]">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-4 mb-12">
              <span className="text-[10px] font-mono text-emerald-500 font-bold uppercase tracking-[0.2em] px-3 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                Question {currentQuestion + 1} / {questions.length}
              </span>
              <div className="flex-1 h-px bg-white/5" />
            </div>
            
            <motion.div
              key={currentQuestion}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              <h3 className="text-3xl lg:text-4xl font-serif mb-12 leading-[1.15] tracking-tight text-white/90">
                {questions[currentQuestion].text}
              </h3>

              <div className="space-y-4">
                {questions[currentQuestion].type === 'FILL_IN_THE_BLANKS' ? (
                  <div className="space-y-4">
                    <input 
                      type="text"
                      value={answers[currentQuestion] === -1 ? '' : answers[currentQuestion] as string}
                      onChange={(e) => {
                        const newAnswers = [...answers];
                        newAnswers[currentQuestion] = e.target.value;
                        setAnswers(newAnswers);
                      }}
                      className="w-full p-8 bg-white/5 border border-white/10 rounded-[32px] text-2xl font-serif outline-none focus:border-emerald-500/50 transition-all placeholder:text-white/10"
                      placeholder="Type your answer here..."
                    />
                    <p className="text-[10px] font-mono text-white/20 uppercase tracking-widest ml-4">Input sequence required for validation</p>
                  </div>
                ) : (
                  questions[currentQuestion].options.map((option, idx) => (
                    <button 
                      key={idx}
                      onClick={() => {
                        const newAnswers = [...answers];
                        newAnswers[currentQuestion] = idx;
                        setAnswers(newAnswers);
                      }}
                      className={cn(
                        "w-full text-left p-6 rounded-[24px] border transition-all duration-300 flex items-center gap-6 group relative overflow-hidden",
                        answers[currentQuestion] === idx 
                          ? "border-emerald-500/50 bg-emerald-500/5 shadow-inner" 
                          : "border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10"
                      )}
                    >
                      {answers[currentQuestion] === idx && (
                        <motion.div 
                          layoutId="active-bg"
                          className="absolute inset-0 bg-emerald-500/5 pointer-events-none"
                        />
                      )}
                      <span className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center text-sm font-mono font-bold transition-all duration-300 z-10",
                        answers[currentQuestion] === idx 
                          ? "bg-emerald-50 text-black shadow-lg shadow-emerald-500/40" 
                          : "bg-white/5 text-white/40 group-hover:bg-white/10 group-hover:text-white"
                      )}>
                        {questions[currentQuestion].type === 'TRUE_FALSE' ? (idx === 0 ? 'T' : 'F') : String.fromCharCode(65 + idx)}
                      </span>
                      <span className={cn(
                        "text-lg font-medium transition-colors duration-300 z-10",
                        answers[currentQuestion] === idx ? "text-white" : "text-white/60"
                      )}>{option}</span>
                    </button>
                  ))
                )}
              </div>
            </motion.div>

            <div className="mt-16 flex justify-between items-center border-t border-white/5 pt-12">
              <button 
                disabled={currentQuestion === 0}
                onClick={() => setCurrentQuestion(prev => prev - 1)}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-white/40 font-mono text-sm hover:text-white transition-colors disabled:opacity-0"
              >
                <ArrowRight className="w-4 h-4 rotate-180" />
                PREV_SEC
              </button>
              
              <div className="flex gap-2">
                {questions.map((_, i) => (
                  <div 
                    key={i}
                    className={cn(
                      "w-1.5 h-1.5 rounded-full transition-all duration-500",
                      i === currentQuestion ? "bg-emerald-500 w-6" : i < currentQuestion ? "bg-emerald-500/40" : "bg-white/10"
                    )}
                  />
                ))}
              </div>

              <button 
                onClick={() => {
                  if (currentQuestion < questions.length - 1) {
                    setCurrentQuestion(prev => prev + 1);
                  } else {
                    finishExam();
                  }
                }}
                className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-white text-black font-bold text-sm hover:bg-emerald-400 transition-all active:scale-95"
              >
                {currentQuestion === questions.length - 1 ? 'TERMINATE_SESSION' : 'NEXT_SEQUENCE'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Right: Proctoring & Monitoring - Hardware/Specialist Feel */}
        <div className="lg:col-span-4 bg-black border-l border-white/5 flex flex-col">
          <div className="p-8 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
            {/* Camera Feed */}
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Primary Visual Feed</span>
                <span className="text-[10px] font-mono text-emerald-500 animate-pulse">REC // 1080P</span>
              </div>
              <div className="relative aspect-video rounded-[24px] overflow-hidden border border-white/10 bg-zinc-900 group">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className="w-full h-full object-cover scale-x-[-1] opacity-80 grayscale-[0.2] contrast-125"
                />
                
                {/* Technical Overlays */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_rgba(0,0,0,0.4)_100%)]" />
                  <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.02),rgba(0,255,0,0.01),rgba(0,0,255,0.02))] bg-[length:100%_2px,3px_100%]" />
                  
                  {/* Corner Brackets */}
                  <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-white/20" />
                  <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-white/20" />
                  <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-white/20" />
                  <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-white/20" />
                </div>

                {gazeDirection && (
                  <div 
                    className="absolute w-6 h-6 border border-emerald-500/50 rounded-full pointer-events-none transition-all duration-150"
                    style={{ 
                      left: `${(1 - gazeDirection.x) * 100}%`, 
                      top: `${gazeDirection.y * 100}%`,
                      transform: 'translate(-50%, -50%)'
                    }}
                  >
                    <div className="absolute inset-0 bg-emerald-500/10 animate-ping rounded-full" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-emerald-500 rounded-full" />
                  </div>
                )}
                
                <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />
                
                <div className="absolute top-4 left-4 flex gap-2">
                  <div className={cn(
                    "px-3 py-1 rounded-lg text-[9px] font-mono font-bold uppercase tracking-widest flex items-center gap-2 backdrop-blur-md border",
                    status === "Exam Running" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"
                  )}>
                    <div className={cn("w-1 h-1 rounded-full", status === "Exam Running" ? "bg-emerald-400 animate-pulse" : "bg-red-400")} />
                    {status}
                  </div>
                </div>

                {devices.length > 1 && (
                  <button 
                    onClick={switchCamera}
                    className="absolute bottom-4 left-4 p-2 bg-black/40 hover:bg-black/60 text-white/60 hover:text-white rounded-xl transition-all border border-white/10 backdrop-blur-md"
                  >
                    <RefreshCcw className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Monitoring Logs - Monospace/Technical */}
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Integrity Log</span>
                <span className="text-[10px] font-mono text-white/20">v4.0.2_STABLE</span>
              </div>
              <div className="bg-zinc-900/50 rounded-[24px] border border-white/5 p-6 min-h-[300px] flex flex-col">
                <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                  {violations.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-20">
                      <ShieldCheck className="w-12 h-12" />
                      <p className="text-[10px] font-mono uppercase tracking-widest">System Nominal // No Anomalies</p>
                    </div>
                  ) : (
                    violations.map((v, i) => (
                      <motion.div 
                        key={i} 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex gap-4 items-start p-3 rounded-xl bg-white/[0.02] border border-white/5"
                      >
                        <div className="mt-1">
                          {v.type === 'TAB_SWITCH' ? <ExternalLink className="w-3 h-3 text-orange-500" /> :
                           v.type === 'MULTIPLE_FACES' ? <Users className="w-3 h-3 text-red-500" /> :
                           v.type === 'LOOKING_AWAY' ? <EyeOff className="w-3 h-3 text-yellow-500" /> :
                           v.type === 'SIGNIFICANT_MOVEMENT' ? <Move className="w-3 h-3 text-purple-500" /> :
                           v.type === 'POSITION_CHANGE' ? <Sun className="w-3 h-3 text-amber-500" /> :
                           v.type === 'GAZE_DEVIATION' ? <Eye className="w-3 h-3 text-emerald-500" /> :
                           <Eye className="w-3 h-3 text-gray-500" />}
                        </div>
                        <div className="flex-1">
                          <p className="text-[11px] font-mono font-medium text-white/80 leading-relaxed">{v.message}</p>
                          <p className="text-[9px] font-mono text-white/20 mt-1">
                            [{new Date(v.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]
                          </p>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
                
                <div className="mt-6 pt-6 border-t border-white/5">
                  <div className="flex justify-between items-center text-[9px] font-mono text-white/20 uppercase tracking-widest">
                    <span>AI Confidence</span>
                    <span>98.4%</span>
                  </div>
                  <div className="h-1 bg-white/5 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-emerald-500/40 w-[98.4%]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const ReportPage = ({ report, onRestart }: { report: ExamReport, onRestart: () => void }) => {
  const statusConfig = {
    CLEAN: { icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Clean Exam', desc: 'No suspicious activity detected.' },
    SUSPICIOUS: { icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50', label: 'Suspicious', desc: 'Minor violations were recorded.' },
    CHEATING: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', label: 'Cheating Detected', desc: 'Multiple or major violations led to auto-submission.' }
  };

  const config = statusConfig[report.status];

  const handleShare = async () => {
    const shareData = {
      title: 'Exam Report - Smart AI Proctor',
      text: `Exam Report for ${report.student.name} (${report.student.rollNumber})\nStatus: ${report.status}\nViolations: ${report.violations.length}`,
      url: window.location.href
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.log('Share failed:', err);
      }
    } else {
      navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      alert("Report copied to clipboard!");
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f0] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl bg-white rounded-[40px] shadow-2xl overflow-hidden border border-black/5"
      >
        <div className={cn("p-12 text-center", config.bg)}>
          <div className={cn("w-20 h-20 mx-auto rounded-3xl flex items-center justify-center mb-6 shadow-lg bg-white", config.color)}>
            <config.icon className="w-10 h-10" />
          </div>
          <h1 className={cn("text-4xl font-serif font-medium mb-2", config.color)}>{config.label}</h1>
          <p className="text-gray-500">{config.desc}</p>
        </div>

        <div className="p-12 space-y-8">
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Student</p>
              <p className="text-lg font-medium text-gray-900">{report.student.name}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Roll Number</p>
              <p className="text-lg font-medium text-gray-900">{report.student.rollNumber}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Violations</p>
              <p className="text-lg font-medium text-gray-900">{report.violations.length}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Duration</p>
              <p className="text-lg font-medium text-gray-900">
                {Math.floor((report.endTime - report.startTime) / 1000)} seconds
              </p>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-8">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Question Review</h3>
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {report.questions?.map((q, i) => {
                const studentAnswer = report.answers[i];
                const isCorrect = q.type === 'FILL_IN_THE_BLANKS' 
                  ? (typeof studentAnswer === 'string' && studentAnswer.toLowerCase().trim() === (q.correctAnswer as string).toLowerCase().trim())
                  : studentAnswer === q.correctAnswer;

                return (
                  <div key={i} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-2">
                    <div className="flex justify-between items-start gap-4">
                      <p className="text-sm font-medium text-gray-900">{q.text}</p>
                      {isCorrect ? (
                        <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-8 gap-y-2 text-[10px] font-bold uppercase tracking-widest">
                      <div className="space-y-1">
                        <p className="text-gray-400">Your Answer</p>
                        <p className={isCorrect ? "text-emerald-600" : "text-red-600"}>
                          {q.type === 'MCQ' || q.type === 'TRUE_FALSE' 
                            ? (studentAnswer === -1 ? 'No Answer' : q.options[studentAnswer as number])
                            : (studentAnswer || 'No Answer')}
                        </p>
                      </div>
                      {!isCorrect && (
                        <div className="space-y-1">
                          <p className="text-gray-400">Correct Answer</p>
                          <p className="text-emerald-600">
                            {q.type === 'MCQ' || q.type === 'TRUE_FALSE' 
                              ? q.options[q.correctAnswer as number]
                              : q.correctAnswer}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-gray-100 pt-8">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Detailed Log</h3>
            <div className="space-y-3">
              {report.violations.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No violations recorded.</p>
              ) : (
                report.violations.map((v, i) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-sm font-medium text-gray-700">{v.message}</span>
                    <span className="text-[10px] text-gray-400">{new Date(v.timestamp).toLocaleTimeString()}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex gap-4 mt-8">
            <button 
              onClick={handleShare}
              className="flex-1 bg-gray-100 text-gray-700 py-4 rounded-2xl font-medium flex items-center justify-center gap-2 hover:bg-gray-200 transition-all"
            >
              <Share2 className="w-4 h-4" />
              Share Report
            </button>
            <button 
              onClick={onRestart}
              className="flex-1 bg-black text-white py-4 rounded-2xl font-medium flex items-center justify-center gap-2 hover:bg-gray-800 transition-all"
            >
              <RefreshCcw className="w-4 h-4" />
              Back to Login
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [view, setView] = useState<'SPLASH' | 'LOGIN' | 'EXAM' | 'REPORT' | 'DASHBOARD'>('SPLASH');
  const [student, setStudent] = useState<Student | null>(null);
  const [report, setReport] = useState<ExamReport | null>(null);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [invigilatorDescriptor, setInvigilatorDescriptor] = useState<Float32Array | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (view === 'SPLASH') {
      const timer = setTimeout(() => {
        setView('LOGIN');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [view]);

  const handleLogin = async (role: UserRole, s?: Student, examId?: string, descriptor?: Float32Array) => {
    if (!user) return;

    // Save/Update user profile in Firestore
    const profileData = {
      uid: user.uid,
      email: user.email,
      role,
      name: s?.name || user.email?.split('@')[0] || 'User',
      rollNumber: s?.rollNumber || '',
      updatedAt: Date.now()
    };
    await setDoc(doc(db, 'users', user.uid), profileData, { merge: true });

    if (role === 'TEACHER') {
      setView('DASHBOARD');
    } else if (s && examId && descriptor) {
      const examDoc = await getDoc(doc(db, 'exams', examId));
      if (examDoc.exists()) {
        setStudent(s);
        setSelectedExam({ id: examDoc.id, ...examDoc.data() } as Exam);
        setInvigilatorDescriptor(descriptor);
        setView('EXAM');
      }
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setView('LOGIN');
  };

  const handleComplete = async (r: ExamReport) => {
    setReport(r);
    setView('REPORT');
    
    try {
      await addDoc(collection(db, 'reports'), {
        ...r,
        studentUid: auth.currentUser?.uid,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Failed to save report:", err);
    }
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#f5f5f0] flex items-center justify-center">
        <div className="text-emerald-600 font-serif italic animate-pulse">Loading Proctoring System...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen onAuthSuccess={setUser} />;
  }

  return (
    <div className="font-sans text-gray-900 bg-[#f5f5f0] min-h-screen">
      {view !== 'EXAM' && view !== 'SPLASH' && (
        <nav className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md border-b border-black/5 z-50 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-600" />
            <span className="font-serif font-medium text-lg">ProctorAI</span>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowFeedback(true)}
              className="px-4 py-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 rounded-full border border-emerald-100 hover:bg-emerald-100 transition-all"
            >
              Report Issue
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-full border border-black/5">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-xs font-medium text-gray-600">{user.email}</span>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-red-500 transition-all"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </nav>
      )}

      <AnimatePresence mode="wait">
        {view === 'SPLASH' && (
          <motion.div 
            key="splash" 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex flex-col items-center justify-center bg-emerald-600 text-white z-50"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex flex-col items-center"
            >
              <ShieldCheck className="w-20 h-20 mb-4" />
              <h1 className="text-4xl font-serif font-medium tracking-tight">Smart AI Proctor</h1>
              <p className="text-emerald-100/60 text-sm mt-2 font-medium italic">The safest anti-cheating app developed by Atharv Choudhari</p>
              <div className="mt-8 flex gap-1">
                <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0 }} className="w-2 h-2 bg-white rounded-full" />
                <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }} className="w-2 h-2 bg-white rounded-full" />
                <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.4 }} className="w-2 h-2 bg-white rounded-full" />
              </div>
            </motion.div>
          </motion.div>
        )}
        {view === 'LOGIN' && (
          <motion.div key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pt-20">
            <LoginPage onLogin={handleLogin} />
          </motion.div>
        )}
        {view === 'EXAM' && student && selectedExam && invigilatorDescriptor && (
          <motion.div key="exam" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ExamPage student={student} exam={selectedExam} onComplete={handleComplete} invigilatorDescriptor={invigilatorDescriptor} />
          </motion.div>
        )}
        {view === 'REPORT' && report && (
          <motion.div key="report" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pt-20">
            <ReportPage report={report} onRestart={() => setView('LOGIN')} />
          </motion.div>
        )}
        {view === 'DASHBOARD' && (
          <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pt-20">
            <TeacherDashboard onLogout={handleLogout} />
          </motion.div>
        )}
      </AnimatePresence>

      {user && (
        <FeedbackModal 
          isOpen={showFeedback} 
          onClose={() => setShowFeedback(false)} 
          user={user} 
        />
      )}
    </div>
  );
}
