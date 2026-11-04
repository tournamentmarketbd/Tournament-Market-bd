'use client';

import { useState, useEffect, Suspense } from 'react';
import { auth, googleProvider } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, collection, doc, updateDoc, addDoc, 
  onSnapshot, setDoc, increment, query, where, serverTimestamp
} from 'firebase/firestore';
import Link from 'next/link';

const formatDate = (timestamp: any) => {
  if (!timestamp) return "এখনই";
  try {
    if (timestamp.toDate) return timestamp.toDate().toLocaleString('bn-BD');
    return new Date(timestamp).toLocaleString('bn-BD');
  } catch (error) { return "তারিখ নেই"; }
};

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
  alert("কপি হয়েছে: " + text);
};

const getAvatarColor = (name: string) => {
  const colors = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

function HomeContent() {
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [showMyTeams, setShowMyTeams] = useState(false);
  const [showWallet, setShowWallet] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showPointTable, setShowPointTable] = useState(false); 
  
  const [showTeamsList, setShowTeamsList] = useState(false);
  const [viewingTournament, setViewingTournament] = useState<any>(null);
  
  const [showPrizeModal, setShowPrizeModal] = useState(false);
  const [viewingPrizeTournament, setViewingPrizeTournament] = useState<any>(null);
  
  const [myTeams, setMyTeams] = useState<any[]>([]);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [allRegistrations, setAllRegistrations] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [pointTable, setPointTable] = useState<any[]>([]); 
  
  const [depositTrxId, setDepositTrxId] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [selectedTournament, setSelectedTournament] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [currentTime, setCurrentTime] = useState(new Date());

  const db = getFirestore(auth.app);
  const ADMIN_EMAIL = "tournamentmarketbd@gmail.com"; 

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAdmin(currentUser?.email === ADMIN_EMAIL);

      if (currentUser) {
        const userRef = doc(db, "users", currentUser.uid);
        const unsubUser = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) setUserData(docSnap.data());
          else {
            setDoc(userRef, { name: currentUser.displayName, email: currentUser.email, balance: 0 });
            setUserData({ balance: 0 });
          }
        });

        const qMyTeams = query(collection(db, "registrations"), where("captainUid", "==", currentUser.uid));
        const unsubMyTeams = onSnapshot(qMyTeams, (snapshot) => {
          const myTeamsData: any[] = [];
          snapshot.forEach((doc) => { myTeamsData.push({ id: doc.id, ...doc.data() }); });
          setMyTeams(myTeamsData);
        });

        const qTrans = query(collection(db, "transactions"), where("userId", "==", currentUser.uid));
        const unsubTrans = onSnapshot(qTrans, (snapshot) => {
          const transData: any[] = [];
          snapshot.forEach((doc) => { transData.push({ id: doc.id, ...doc.data() }); });
          setTransactions(transData.sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0)));
        });

        return () => { unsubUser(); unsubMyTeams(); unsubTrans(); };
      } else {
        setUserData(null); setMyTeams([]); setTransactions([]);
      }
    });
    
    const unsubTournaments = onSnapshot(collection(db, "tournaments"), (snapshot) => {
      const tourData: any[] = [];
      snapshot.forEach((doc) => { tourData.push({ id: doc.id, ...doc.data() }); });
      setTournaments(tourData);
    });

    const unsubAllRegs = onSnapshot(collection(db, "registrations"), (snapshot) => {
      const regsData: any[] = [];
      snapshot.forEach((doc) => { regsData.push({ id: doc.id, ...doc.data() }); });
      setAllRegistrations(regsData);
    });

    const unsubPointTable = onSnapshot(collection(db, "pointTable"), (snapshot) => {
      const tableData: any[] = [];
      snapshot.forEach((doc) => { tableData.push({ id: doc.id, ...doc.data() }); });
      tableData.sort((a, b) => b.tp - a.tp);
      setPointTable(tableData);
    });

    return () => { unsubscribeAuth(); unsubTournaments(); unsubAllRegs(); unsubPointTable(); };
  }, []);

  const handleLogin = async () => { try { await signInWithPopup(auth, googleProvider); } catch (error) { console.error(error); } };
  const handleLogout = async () => { await signOut(auth); setShowWallet(false); setShowMyTeams(false); setShowProfile(false); };

  const getTimeLeft = (startDateString: string) => {
    if (!startDateString) return { isTBA: true, text: "TBA" };
    const targetDate = new Date(startDateString).getTime();
    if (isNaN(targetDate)) return { isTBA: true, text: "TBA" };

    const difference = targetDate - currentTime.getTime();
    if (difference <= 0) return { isLive: true, text: "LIVE NOW" };

    const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((difference / 1000 / 60) % 60);
    const seconds = Math.floor((difference / 1000) % 60);

    return { 
      isLive: false, 
      isTBA: false,
      h: hours.toString().padStart(2, '0'), 
      m: minutes.toString().padStart(2, '0'), 
      s: seconds.toString().padStart(2, '0') 
    };
  };

  const openTeamsList = (tour: any) => {
    setViewingTournament(tour);
    setShowTeamsList(true);
  };

  const openPrizeModal = (tour: any) => {
    setViewingPrizeTournament(tour);
    setShowPrizeModal(true);
  };

  const handleDeposit = async () => {
    if (!depositTrxId || !depositAmount || Number(depositAmount) < 10) { 
      alert("সঠিক ট্রানজেকশন আইডি এবং সর্বনিম্ন ১০ টাকা লিখুন!"); 
      return; 
    }

    try {
      await addDoc(collection(db, "transactions"), {
        userId: user.uid, userEmail: user.email, userName: user.displayName || "Unknown", type: "deposit", amount: Number(depositAmount), trxId: depositTrxId, status: "pending", date: serverTimestamp()
      });
      alert("ডিপোজিট রিকোয়েস্ট পাঠানো হয়েছে!");
      setDepositTrxId(""); setDepositAmount(""); setShowWallet(false);
    } catch (error) { console.error(error); }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || Number(withdrawAmount) < 50) { alert("সর্বনিম্ন ৫০ টাকা!"); return; }
    if (Number(withdrawAmount) > userData.balance) { alert("ব্যালেন্স নেই!"); return; }
    const userTeamName = myTeams.length > 0 ? myTeams[0].teamName : "লোন প্লেয়ার";
    try {
      await updateDoc(doc(db, "users", user.uid), { balance: increment(-Number(withdrawAmount)) });
      await addDoc(collection(db, "transactions"), {
        userId: user.uid, userEmail: user.email, userName: user.displayName || "Unknown", teamName: userTeamName, type: "withdraw", amount: Number(withdrawAmount), status: "pending", date: serverTimestamp()
      });
      alert("উইথড্র রিকোয়েস্ট পাঠানো হয়েছে!");
      setWithdrawAmount(""); setShowWallet(false);
    } catch (error) { console.error(error); }
  };

  const handleJoinTournament = (tour: any) => {
    if (!user) { alert("আগে লগইন করুন!"); return; }
    if (userData.balance < tour.entryFee) { alert("ব্যালেন্স নেই!"); setShowWallet(true); return; }
    
    const alreadyRegistered = allRegistrations.some((reg) => reg.tournamentId === tour.id && reg.captainUid === user.uid);
    if (alreadyRegistered) { alert("আপনি ইতিমধ্যে রেজিস্টার করেছেন!"); return; }
    
    const currentTeamsCount = allRegistrations.filter((reg) => reg.tournamentId === tour.id).length;
    if (currentTeamsCount >= tour.maxTeams) { alert("সব স্লট ফুল!"); return; }
    
    setSelectedTournament(tour);
    setShowRegister(true);
  };

  const handleRegisterSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true); 
    
    const formData = new FormData(e.currentTarget);
    try {
      const players = [
        { name: formData.get('p1_name'), uid: formData.get('p1_uid') },
        { name: formData.get('p2_name'), uid: formData.get('p2_uid') },
        { name: formData.get('p3_name'), uid: formData.get('p3_uid') },
        { name: formData.get('p4_name'), uid: formData.get('p4_uid') },
        { name: formData.get('p5_name'), uid: formData.get('p5_uid') },
      ];

      await updateDoc(doc(db, "users", user.uid), { balance: increment(-selectedTournament.entryFee) });

      await addDoc(collection(db, "registrations"), {
        tournamentId: selectedTournament.id, tournamentName: selectedTournament.name,
        captainUid: user.uid, captainEmail: user.email,
        teamName: formData.get('teamName'), teamTag: formData.get('teamTag'),
        players: players, status: "pending", roomId: "", roomPass: "", registeredAt: serverTimestamp()
      });

      await addDoc(collection(db, "transactions"), {
        userId: user.uid, userEmail: user.email, type: "entry_fee", amount: selectedTournament.entryFee, status: "success", date: serverTimestamp(), note: `${selectedTournament.name} এন্ট্রি ফি`
      });

      alert(`সফলভাবে রেজিস্ট্রেশন হয়েছে!`);
      setShowRegister(false);
    } catch (error) { console.error(error); } finally { setIsSubmitting(false); }
  };

  const totalDeposits = transactions.filter(t => t.type === 'deposit' && t.status === 'approved').reduce((sum, t) => sum + t.amount, 0);
  const totalWithdraws = transactions.filter(t => t.type === 'withdraw' && t.status === 'approved').reduce((sum, t) => sum + t.amount, 0);
  const totalEntryFees = transactions.filter(t => t.type === 'entry_fee').reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-purple-500 selection:text-white pb-20">
      
      {/* নেভিগেশন বার */}
      <nav className="sticky top-0 z-40 w-full bg-[#111111]/90 backdrop-blur-md border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-xl md:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-pink-500">
            TOURNAMENT MARKET BD
          </h1>
          
          <div className="flex items-center gap-2 md:gap-4">
            {isAdmin && (
              <Link href="/admin" className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-md text-sm font-semibold transition">
                Admin Panel
              </Link>
            )}
            
            {user ? (
              <div className="flex items-center gap-2 md:gap-4">
                <div onClick={() => setShowProfile(true)} className="flex items-center gap-2 cursor-pointer bg-[#1a1a1a] border border-gray-700 rounded-full pl-3 pr-1 py-1 hover:border-purple-500 transition">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs font-bold text-gray-200">{user.displayName?.split(' ')[0]}</p>
                    <p className="text-xs font-bold text-green-400">৳ {userData?.balance || 0}</p>
                  </div>
                  <img src={user.photoURL || "https://cdn-icons-png.flaticon.com/512/149/149071.png"} alt="Profile" className="w-8 h-8 rounded-full border border-purple-500" />
                </div>
                <button onClick={handleLogout} className="bg-red-600/20 text-red-500 hover:bg-red-600 hover:text-white px-3 py-1.5 rounded-md text-sm font-semibold transition">লগ আউট</button>
              </div>
            ) : (
              <button onClick={handleLogin} className="bg-white text-black font-bold px-4 py-2 rounded-md hover:bg-gray-200 transition">লগইন</button>
            )}
          </div>
        </div>
      </nav>

      <div className="bg-purple-900/20 border-b border-purple-500/20 py-2 overflow-hidden">
        <div className="text-purple-300 text-sm font-bold text-center">
          📢 যেকোনো সমস্যায় আমাদের টেলিগ্রাম গ্রুপে যোগাযোগ করুন। টুর্নামেন্টের রুম আইডি ম্যাচের ১০ মিনিট আগে আপডেট হবে। 📢
        </div>
      </div>

      <header className="text-center py-10 px-4">
        <h2 className="text-3xl md:text-5xl font-extrabold mb-4 animate-fade-in-up">বাংলাদেশের #১ ফ্রি ফায়ার টুর্নামেন্ট</h2>
      </header>

      <main className="max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {tournaments.map((tour) => {
            const registeredCount = allRegistrations.filter(reg => reg.tournamentId === tour.id).length;
            const isFull = registeredCount >= tour.maxTeams;
            const progressPercent = Math.min((registeredCount / tour.maxTeams) * 100, 100);
            const timeLeft = getTimeLeft(tour.startDate);
            const userTeamForThisTour = myTeams.find(t => t.tournamentId === tour.id);
            const totalPrizePool = (tour.prize1 || 0) + (tour.prize2 || 0) + (tour.prize3 || 0) + (tour.prize4 || 0);

            return (
              <div key={tour.id} className="bg-[#151515] rounded-xl p-6 border border-gray-800 hover:border-purple-500/50 transition duration-300 shadow-xl group relative overflow-hidden flex flex-col justify-between transform hover:-translate-y-1">
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <span className="bg-purple-600/20 text-purple-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">{tour.type}</span>
                    <span className="text-yellow-400 text-sm font-bold">{tour.time}</span>
                  </div>
                  <h3 className="text-2xl font-bold mb-4 text-white group-hover:text-purple-400 transition">{tour.name}</h3>
                  
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="bg-[#1a1a1a] p-3 rounded-lg border border-purple-500/30 text-center flex flex-col justify-center">
                      <p className="text-xs text-gray-400 mb-1">এন্ট্রি ফি</p>
                      <p className="font-black text-xl text-white">৳ {tour.entryFee || 0}</p>
                    </div>
                    <div 
                      onClick={() => openPrizeModal(tour)}
                      className="bg-[#1a1a1a] p-3 rounded-lg border border-green-500/30 text-center cursor-pointer hover:bg-[#222] transition group/prize relative flex flex-col justify-center"
                    >
                      <p className="text-xs text-gray-400 mb-1 group-hover/prize:text-green-400">মোট প্রাইজ পুল</p>
                      <p className="font-black text-xl text-green-400">৳ {totalPrizePool}</p>
                    </div>
                  </div>

                  <div className="mb-4 bg-[#1a1a1a] border border-yellow-500/30 rounded-lg p-3 text-center">
                    <p className="text-[10px] text-gray-400 mb-2 uppercase tracking-widest">ম্যাচ শুরু হতে বাকি</p>
                    {timeLeft.isTBA ? (
                      <p className="font-mono font-black text-xl text-gray-500">TBA</p>
                    ) : timeLeft.isLive ? (
                      <p className="font-mono font-black text-xl text-red-500 animate-pulse">LIVE NOW</p>
                    ) : (
                      <div className="flex justify-center items-center gap-1 font-mono font-black text-2xl text-yellow-400">
                        <div className="flex flex-col items-center">
                          <span>{timeLeft.h}</span>
                          <span className="text-[9px] text-gray-500 font-sans mt-1">ঘণ্টা</span>
                        </div>
                        <span className="pb-4">:</span>
                        <div className="flex flex-col items-center">
                          <span>{timeLeft.m}</span>
                          <span className="text-[9px] text-gray-500 font-sans mt-1">মিনিট</span>
                        </div>
                        <span className="pb-4">:</span>
                        <div className="flex flex-col items-center">
                          <span>{timeLeft.s}</span>
                          <span className="text-[9px] text-gray-500 font-sans mt-1">সেকেন্ড</span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <button 
                    onClick={() => openTeamsList(tour)} 
                    className="w-full bg-[#222] hover:bg-[#333] text-gray-300 font-bold py-2 rounded-lg text-xs border border-gray-700 transition mb-4"
                  >
                    👥 রেজিস্টার্ড টিম দেখুন
                  </button>

                  <div className="mb-5">
                    <div className="flex justify-between text-xs mb-2">
                      <span className="text-gray-400">রেজিস্ট্রেশন</span>
                      <span className={isFull ? "text-red-400 font-bold" : "text-purple-400 font-bold"}>
                        {registeredCount}/{tour.maxTeams} টিম
                      </span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2">
                      <div className={`h-2 rounded-full transition-all duration-500 ${isFull ? 'bg-red-500' : 'bg-gradient-to-r from-purple-500 to-pink-500'}`} style={{ width: `${progressPercent}%` }}></div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setShowPointTable(true)} className="bg-[#1a1a1a] hover:bg-[#222] text-yellow-500 font-bold py-3 rounded-lg text-sm border border-yellow-500/30 transition flex items-center justify-center gap-1">
                    🏆 পয়েন্ট টেবিল
                  </button>
                  
                  {userTeamForThisTour ? (
                    <button onClick={() => setShowMyTeams(true)} className="bg-green-600/20 text-green-400 font-bold py-3 rounded-lg text-sm border border-green-500/30 transition flex items-center justify-center gap-1">
                      🔑 My Pass
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleJoinTournament(tour)} 
                      disabled={isFull}
                      className={`font-bold py-3 rounded-lg shadow-lg transition transform active:scale-95 text-sm ${
                        isFull ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 text-white shadow-green-500/20'
                      }`}
                    >
                      {isFull ? 'Full' : 'Join Now'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* ফ্লোটিং সাপোর্ট বাটন */}
      <div className="fixed bottom-24 right-6 z-50 flex flex-col gap-4">
        <a 
          href="https://wa.me/8801922897145" // আপনার হোয়াটসঅ্যাপ নম্বর এখানে দিন
          target="_blank" 
          rel="noopener noreferrer"
          className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center text-white shadow-[0_0_20px_rgba(34,197,94,0.5)] animate-[spin_4s_linear_infinite] hover:animate-none hover:scale-110 transition-transform"
          title="WhatsApp Support"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
        </a>

        <a 
          href="https://t.me/@tournamentmarketbd" // আপনার টেলিগ্রাম লিংক এখানে দিন
          target="_blank" 
          rel="noopener noreferrer"
          className="w-14 h-14 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-[0_0_20px_rgba(59,130,246,0.5)] animate-[spin_4s_linear_infinite] hover:animate-none hover:scale-110 transition-transform"
          title="Telegram Support"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="currentColor" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
        </a>
      </div>

      {/* মডাল সমূহ */}
      {showProfile && user && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-[#151515] border border-gray-800 rounded-2xl w-full max-w-sm overflow-hidden relative">
            <div className="h-24 bg-gradient-to-r from-purple-600 to-pink-600"></div>
            <button onClick={() => setShowProfile(false)} className="absolute top-4 right-4 text-white hover:bg-black/30 w-8 h-8 rounded-full flex items-center justify-center">&times;</button>
            <div className="px-6 pb-6 text-center">
              <img src={user.photoURL || "https://cdn-icons-png.flaticon.com/512/149/149071.png"} alt="Profile" className="w-20 h-20 rounded-full border-4 border-[#151515] mx-auto -mt-10 shadow-lg" />
              <h2 className="text-xl font-bold text-white mt-3">{user.displayName}</h2>
              <p className="text-gray-400 text-xs">{user.email}</p>
              <div className="bg-[#0a0a0a] p-4 rounded-xl border border-gray-800 mt-6 flex justify-between items-center">
                <div className="text-left">
                  <p className="text-gray-400 text-[10px] uppercase font-bold mb-1">বর্তমান ব্যালেন্স</p>
                  <p className="text-2xl font-black text-green-400">৳ {userData?.balance || 0}</p>
                </div>
                <button onClick={() => { setShowProfile(false); setShowWallet(true); }} className="bg-green-600/20 text-green-400 border border-green-600 hover:bg-green-600 hover:text-white px-4 py-2 rounded-lg text-sm font-bold transition">ওয়ালেট</button>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="bg-[#1a1a1a] p-3 rounded-xl border border-gray-800 flex flex-col items-center justify-center">
                  <p className="text-gray-500 text-[10px] uppercase font-bold mb-1">মোট ডিপোজিট</p>
                  <p className="text-lg font-black text-green-400">৳ {totalDeposits}</p>
                </div>
                <div className="bg-[#1a1a1a] p-3 rounded-xl border border-gray-800 flex flex-col items-center justify-center">
                  <p className="text-gray-500 text-[10px] uppercase font-bold mb-1">মোট উইথড্র</p>
                  <p className="text-lg font-black text-red-400">৳ {totalWithdraws}</p>
                </div>
                <div className="bg-[#1a1a1a] p-3 rounded-xl border border-gray-800 flex flex-col items-center justify-center">
                  <p className="text-gray-500 text-[10px] uppercase font-bold mb-1">মোট এন্ট্রি ফি</p>
                  <p className="text-lg font-black text-yellow-500">৳ {totalEntryFees}</p>
                </div>
                <div className="bg-[#1a1a1a] p-3 rounded-xl border border-gray-800 flex flex-col items-center justify-center">
                  <p className="text-gray-500 text-[10px] uppercase font-bold mb-1">মোট টিম</p>
                  <p className="text-lg font-black text-blue-400">{myTeams.length} টি</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showMyTeams && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-[#151515] border border-gray-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-800 flex justify-between items-center bg-[#111]">
              <h2 className="text-xl font-black text-white flex items-center gap-2"><span className="text-blue-500">🛡️</span> আমার টিম</h2>
              <button onClick={() => setShowMyTeams(false)} className="text-gray-400 hover:text-white text-2xl font-bold">&times;</button>
            </div>
            <div className="p-5 space-y-4">
              {myTeams.length === 0 ? <p className="text-gray-500 text-center py-6">আপনি এখনো রেজিস্টার করেননি।</p> : (
                myTeams.map((team) => {
                  const tourData = tournaments.find(t => t.id === team.tournamentId);
                  let isTimeToShow = false;
                  if (tourData && tourData.startDate) {
                    const matchTime = new Date(tourData.startDate).getTime();
                    const currentTimeMs = currentTime.getTime();
                    const tenMinsInMs = 10 * 60 * 1000;
                    if (currentTimeMs >= (matchTime - tenMinsInMs)) {
                      isTimeToShow = true;
                    }
                  }
                  const avatarBg = getAvatarColor(team.teamName);
                  const initial = team.teamName.charAt(0).toUpperCase();

                  return (
                  <div key={team.id} className="bg-[#1a1a1a] rounded-xl border border-gray-800 overflow-hidden">
                    <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-[#222]">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg ${avatarBg}`}>
                          {initial}
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white leading-tight">{team.teamName} <span className="text-xs text-purple-400">({team.teamTag})</span></h3>
                          <p className="text-xs text-gray-400 mt-0.5">{team.tournamentName}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${team.status === 'approved' ? 'bg-green-500/20 text-green-400' : team.status === 'rejected' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{team.status}</span>
                    </div>
                    {team.status === 'approved' && (
                      <div className="p-4">
                        {isTimeToShow ? (
                          team.roomId ? (
                            <div className="grid grid-cols-2 gap-3">
                              <div className="bg-[#0a0a0a] p-3 rounded-lg border border-green-500/30 flex flex-col justify-center items-center relative group">
                                <p className="text-[10px] text-green-500 uppercase font-bold mb-1">Room ID</p>
                                <p className="font-mono font-bold text-white text-lg">{team.roomId}</p>
                                <button onClick={() => copyToClipboard(team.roomId)} className="absolute inset-0 bg-purple-600/90 text-white font-bold opacity-0 group-hover:opacity-100 transition flex items-center justify-center rounded-lg">কপি করুন</button>
                              </div>
                              <div className="bg-[#0a0a0a] p-3 rounded-lg border border-green-500/30 flex flex-col justify-center items-center relative group">
                                <p className="text-[10px] text-green-500 uppercase font-bold mb-1">Password</p>
                                <p className="font-mono font-bold text-white text-lg">{team.roomPass}</p>
                                <button onClick={() => copyToClipboard(team.roomPass)} className="absolute inset-0 bg-purple-600/90 text-white font-bold opacity-0 group-hover:opacity-100 transition flex items-center justify-center rounded-lg">কপি করুন</button>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 rounded-lg text-center">
                              <p className="text-yellow-500 font-bold mb-1">⏳ অপেক্ষা করুন</p>
                              <p className="text-xs text-gray-400">অ্যাডমিন এখনো রুম আইডি আপডেট করেনি। কিছুক্ষণ পর চেক করুন।</p>
                            </div>
                          )
                        ) : (
                          <div className="bg-[#222] border border-gray-700 p-4 rounded-lg text-center">
                            <p className="text-gray-400 font-bold mb-1 flex items-center justify-center gap-2"><span className="text-xl">🔒</span> রুম আইডি লক করা আছে</p>
                            <p className="text-xs text-gray-500">ম্যাচ শুরু হওয়ার ঠিক ১০ মিনিট আগে আপনি রুম আইডি ও পাসওয়ার্ড দেখতে পাবেন।</p>
                          </div>
                        )}
                        <div className="mt-4 pt-4 border-t border-gray-800">
                          <p className="text-[10px] text-gray-500 uppercase font-bold mb-2">Players</p>
                          <div className="space-y-1">
                            {team.players?.map((p: any, i: number) => (
                              <div key={i} className="flex justify-between text-xs">
                                <span className="text-gray-400">{p.name}</span>
                                <span className="text-gray-500 font-mono">{p.uid}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )})
              )}
            </div>
          </div>
        </div>
      )}

      {showPrizeModal && viewingPrizeTournament && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-[#151515] border border-gray-800 rounded-2xl w-full max-w-sm overflow-hidden">
            <div className="p-5 border-b border-gray-800 flex justify-between items-center bg-[#111]">
              <div>
                <h2 className="text-xl font-black text-green-400">প্রাইজ পুল</h2>
                <p className="text-xs text-gray-400">{viewingPrizeTournament.name}</p>
              </div>
              <button onClick={() => setShowPrizeModal(false)} className="text-gray-400 hover:text-white text-2xl font-bold">&times;</button>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex justify-between items-center bg-[#0a0a0a] p-3 rounded-lg border border-yellow-500/30">
                <span className="text-yellow-500 font-bold">১ম স্থান 🥇</span>
                <span className="font-black text-white text-lg">৳ {viewingPrizeTournament.prize1 || 0}</span>
              </div>
              <div className="flex justify-between items-center bg-[#0a0a0a] p-3 rounded-lg border border-gray-500/30">
                <span className="text-gray-300 font-bold">২য় স্থান 🥈</span>
                <span className="font-black text-white text-lg">৳ {viewingPrizeTournament.prize2 || 0}</span>
              </div>
              <div className="flex justify-between items-center bg-[#0a0a0a] p-3 rounded-lg border border-amber-600/30">
                <span className="text-amber-600 font-bold">৩য় স্থান 🥉</span>
                <span className="font-black text-white text-lg">৳ {viewingPrizeTournament.prize3 || 0}</span>
              </div>
              <div className="flex justify-between items-center bg-[#0a0a0a] p-3 rounded-lg border border-gray-800">
                <span className="text-gray-500 font-bold">৪র্থ স্থান</span>
                <span className="font-black text-white text-lg">৳ {viewingPrizeTournament.prize4 || 0}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {showTeamsList && viewingTournament && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-[#151515] border border-gray-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-800 flex justify-between items-center bg-[#111] sticky top-0 z-10">
              <div>
                <h2 className="text-xl font-black text-white">রেজিস্টার্ড টিম</h2>
                <p className="text-xs text-purple-400">{viewingTournament.name}</p>
              </div>
              <button onClick={() => setShowTeamsList(false)} className="text-gray-400 hover:text-white text-2xl font-bold">&times;</button>
            </div>
            <div className="p-5">
              <div className="space-y-3">
                {allRegistrations.filter(reg => reg.tournamentId === viewingTournament.id).length === 0 ? (
                  <p className="text-gray-500 text-center py-6">এখনো কোনো টিম রেজিস্টার করেনি।</p>
                ) : (
                  allRegistrations.filter(reg => reg.tournamentId === viewingTournament.id).map((team, index) => (
                    <div key={team.id} className="bg-[#1a1a1a] p-3 rounded-lg border border-gray-800 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-purple-600/20 text-purple-400 border border-purple-500/30 rounded flex items-center justify-center font-black text-xs">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-bold text-white uppercase text-sm">{team.teamName}</p>
                          <p className="text-xs text-gray-500">({team.teamTag})</p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded text-[10px] font-bold ${team.status === 'approved' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                        {team.status === 'approved' ? 'Approved' : 'Pending'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showPointTable && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-[#151515] border border-gray-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-800 flex justify-between items-center sticky top-0 bg-[#151515] z-10">
              <h2 className="text-xl font-black text-yellow-500 flex items-center gap-2"><span className="text-2xl">🏆</span> পয়েন্ট টেবিল</h2>
              <button onClick={() => setShowPointTable(false)} className="text-gray-400 hover:text-white text-2xl font-bold">&times;</button>
            </div>
            <div className="p-4 overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[500px]">
                <thead className="bg-[#1a1a1a] text-gray-400 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-3 text-center">#</th>
                    <th className="py-3 px-3">Team</th>
                    <th className="py-3 px-3 text-center">MP</th>
                    <th className="py-3 px-3 text-center">CD</th>
                    <th className="py-3 px-3 text-center">PP</th>
                    <th className="py-3 px-3 text-center">KP</th>
                    <th className="py-3 px-3 text-center text-yellow-500">TP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {pointTable.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-8 text-gray-500">এখনো পয়েন্ট আপডেট হয়নি।</td></tr>
                  ) : (
                    pointTable.map((team, index) => (
                      <tr key={team.id} className="hover:bg-[#1a1a1a]/50">
                        <td className="py-3 px-3 text-center font-bold text-gray-500">{String(index + 1).padStart(2, '0')}</td>
                        <td className="py-3 px-3 font-bold text-white uppercase">{team.teamName} {index === 0 && '🏆'}</td>
                        <td className="py-3 px-3 text-center text-gray-400">{team.mp}</td>
                        <td className="py-3 px-3 text-center text-yellow-500 font-bold">{team.cd > 0 ? team.cd : '-'}</td>
                        <td className="py-3 px-3 text-center text-gray-400">{team.pp}</td>
                        <td className="py-3 px-3 text-center text-gray-400">{team.kp}</td>
                        <td className="py-3 px-3 text-center font-black text-green-400 text-lg">{team.tp}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showWallet && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-[#151515] border border-gray-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-green-400">আমার ওয়ালেট</h2>
              <button onClick={() => setShowWallet(false)} className="text-gray-400 hover:text-white text-2xl font-bold">&times;</button>
            </div>
            <div className="bg-[#0a0a0a] p-5 rounded-xl text-center mb-6 border border-gray-800">
              <p className="text-gray-400 text-xs uppercase mb-1">বর্তমান ব্যালেন্স</p>
              <p className="text-4xl font-black text-white">৳ {userData?.balance || 0}</p>
            </div>
            <div className="space-y-4 mb-6">
              <div className="bg-[#1a1a1a] p-4 rounded-xl border border-green-500/30">
                <p className="text-xs font-bold text-green-400 mb-2 uppercase tracking-wider">টাকা জমা দিন (Deposit)</p>
                <div className="flex items-center justify-between bg-[#0a0a0a] border border-gray-700 p-3 rounded-lg mb-3">
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-bold">bKash / Nagad (Personal)</p>
                    <p className="font-mono text-white font-bold text-lg tracking-wider">01922-897145</p>
                  </div>
                  <button onClick={() => copyToClipboard('01922897145')} className="bg-green-600/20 hover:bg-green-600 text-green-400 hover:text-white px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1 border border-green-500/30">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    কপি
                  </button>
                </div>
                <div className="space-y-2">
                  <input type="text" placeholder="ট্রানজেকশন আইডি (TrxID)" value={depositTrxId} onChange={(e) => setDepositTrxId(e.target.value)} className="w-full bg-[#0a0a0a] border border-gray-700 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-green-500" />
                  <div className="flex gap-2">
                     <input type="number" placeholder="৳ পরিমাণ" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} className="w-1/2 bg-[#0a0a0a] border border-gray-700 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-green-500" />
                     <button onClick={handleDeposit} className="w-1/2 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg transition">জমা দিন</button>
                  </div>
                </div>
              </div>
              <div className="bg-[#1a1a1a] p-4 rounded-xl border border-gray-800">
                <p className="text-xs font-bold text-yellow-400 mb-2 uppercase tracking-wider">টাকা উত্তোলন (Withdraw)</p>
                <div className="flex gap-2">
                  <input type="number" placeholder="৳ পরিমাণ" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} className="flex-1 bg-[#0a0a0a] border border-gray-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-yellow-500" />
                  <button onClick={handleWithdraw} className="bg-yellow-600 hover:bg-yellow-500 text-black px-4 py-2 rounded-lg font-bold text-sm">তুলুন</button>
                </div>
              </div>
            </div>
            <div className="border-t border-gray-800 pt-4">
               <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">লেনদেনের ইতিহাস</h3>
               <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                 {transactions.map(t => (
                    <div key={t.id} className="flex justify-between items-center bg-[#1a1a1a] p-2 rounded border border-gray-800 text-xs">
                      <div>
                        <p className="font-bold text-white capitalize">{t.type === 'deposit' ? 'ডিপোজিট' : t.type === 'withdraw' ? 'উইথড্র' : 'এন্ট্রি ফি'}</p>
                        <p className="text-[10px] text-gray-500">{formatDate(t.date)}</p>
                      </div>
                      <p className={`font-bold ${t.type === 'deposit' ? 'text-green-400' : 'text-red-400'}`}>{t.type === 'deposit' ? '+' : '-'} ৳ {t.amount}</p>
                    </div>
                 ))}
               </div>
            </div>
          </div>
        </div>
      )}

      {showRegister && selectedTournament && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-[#151515] border border-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">রেজিস্ট্রেশন</h2>
              <button onClick={() => setShowRegister(false)} className="text-gray-400 hover:text-white text-2xl font-bold">&times;</button>
            </div>
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <input type="text" name="teamName" required placeholder="টিমের নাম" className="w-full bg-[#0a0a0a] border border-gray-700 rounded-lg p-3 text-white" />
                <input type="text" name="teamTag" required maxLength={3} placeholder="ট্যাগ" className="w-full bg-[#0a0a0a] border border-gray-700 rounded-lg p-3 text-white uppercase" />
              </div>
              <div className="pt-4 border-t border-gray-800">
                <h3 className="text-sm font-bold text-gray-400 mb-3">প্লেয়ার তথ্য</h3>
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((num) => (
                    <div key={num} className="flex gap-2">
                      <input type="text" name={`p${num}_name`} required placeholder={`Player ${num}`} className="flex-1 bg-[#0a0a0a] border border-gray-700 rounded-lg p-2 text-sm text-white" />
                      <input type="text" name={`p${num}_uid`} required placeholder="FF UID" className="flex-1 bg-[#0a0a0a] border border-gray-700 rounded-lg p-2 text-sm text-white" />
                    </div>
                  ))}
                </div>
              </div>
              <button type="submit" disabled={isSubmitting} className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl mt-4">
                {isSubmitting ? "অপেক্ষা করুন..." : `সাবমিট (৳ ${selectedTournament.entryFee})`}
              </button>
            </form>
          </div>
        </div>
      )}

      <footer className="text-center py-8 border-t border-gray-800 mt-10 relative z-10">
        <h4 className="text-lg font-black text-white mb-2">Tournament Market BD</h4>
        <p className="text-xs text-gray-500 mb-4">বাংলাদেশের #১ ফ্রি ফায়ার টুর্নামেন্ট প্ল্যাটফর্ম</p>
        <div className="flex justify-center gap-4">
          <a href="https://www.youtube.com/@TOURNAMENTMARKETBD" target="_blank" rel="noopener noreferrer" className="bg-[#1a1a1a] border border-gray-800 px-4 py-2 rounded-lg text-sm flex items-center gap-2 text-gray-400 hover:text-red-500 hover:border-red-500 transition">
            <span className="text-red-500">▶</span> YouTube
          </a>
          <a href="https://facebook.com/your_page" target="_blank" rel="noopener noreferrer" className="bg-[#1a1a1a] border border-gray-800 px-4 py-2 rounded-lg text-sm flex items-center gap-2 text-gray-400 hover:text-blue-500 hover:border-blue-500 transition">
            <span className="text-blue-500">f</span> Facebook
          </a>
          <a href="https://t.me/your_channel" target="_blank" rel="noopener noreferrer" className="bg-[#1a1a1a] border border-gray-800 px-4 py-2 rounded-lg text-sm flex items-center gap-2 text-gray-400 hover:text-blue-400 hover:border-blue-400 transition">
            <span className="text-blue-400">✈</span> Telegram
          </a>
        </div>
      </footer>

    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0a] text-white flex justify-center items-center font-bold text-xl animate-pulse">লোড হচ্ছে...</div>}>
      <HomeContent />
    </Suspense>
  );
}