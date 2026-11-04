'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { auth, googleProvider } from '../firebase';
import { signInWithPopup, onAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, collection, getDocs, doc, updateDoc, addDoc, 
  onSnapshot, increment, query, where, deleteDoc
} from 'firebase/firestore';
import Link from 'next/link';

function AdminPanel() {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // ডেটা স্টেট
  const [teams, setTeams] = useState<any[]>([]);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [pendingDeposits, setPendingDeposits] = useState<any[]>([]);
  const [pendingWithdraws, setPendingWithdraws] = useState<any[]>([]);
  const [pointTable, setPointTable] = useState<any[]>([]); 

  const db = getFirestore(auth.app);
  const ADMIN_EMAIL = "tournamentmarketbd@gmail.com"; 

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser && currentUser.email === ADMIN_EMAIL) setIsAdmin(true);
      else setIsAdmin(false);
      setLoading(false);
    });
    return () => unsubscribeAuth();
  }, []);

  const loadAdminData = async () => {
    try {
      const teamSnap = await getDocs(collection(db, "registrations"));
      const teamsData: any[] = [];
      teamSnap.forEach((doc) => { teamsData.push({ id: doc.id, ...doc.data() }); });
      setTeams(teamsData);

      const qDep = query(collection(db, "transactions"), where("type", "==", "deposit"), where("status", "==", "pending"));
      const depSnap = await getDocs(qDep);
      const depData: any[] = [];
      depSnap.forEach((doc) => { depData.push({ id: doc.id, ...doc.data() }); });
      setPendingDeposits(depData);

      const qWith = query(collection(db, "transactions"), where("type", "==", "withdraw"), where("status", "==", "pending"));
      const withSnap = await getDocs(qWith);
      const withData: any[] = [];
      withSnap.forEach((doc) => { withData.push({ id: doc.id, ...doc.data() }); });
      setPendingWithdraws(withData);
    } catch (error) { console.error(error); }
  };

  useEffect(() => {
    if (isAdmin) {
      loadAdminData();
      
      const unsubTour = onSnapshot(collection(db, "tournaments"), (snapshot) => {
        const tData: any[] = [];
        snapshot.forEach((doc) => { tData.push({ id: doc.id, ...doc.data() }); });
        setTournaments(tData);
      });

      const unsubPointTable = onSnapshot(collection(db, "pointTable"), (snapshot) => {
        const tableData: any[] = [];
        snapshot.forEach((doc) => { tableData.push({ id: doc.id, ...doc.data() }); });
        tableData.sort((a, b) => b.tp - a.tp);
        setPointTable(tableData);
      });

      return () => { unsubTour(); unsubPointTable(); };
    }
  }, [isAdmin]);

  const handleLogin = async () => { try { await signInWithPopup(auth, googleProvider); } catch (error) { console.error(error); } };

  const updatePrize = async (tourId: string, prizeType: string, value: string) => {
    try {
      const tourRef = doc(db, "tournaments", tourId);
      await updateDoc(tourRef, { [prizeType]: Number(value) });
      alert("প্রাইজ আপডেট হয়েছে!");
    } catch (error) { console.error(error); }
  };

  const approveDeposit = async (transactionId: string, userId: string, amount: number) => {
    try {
      await updateDoc(doc(db, "transactions", transactionId), { status: "approved" });
      await updateDoc(doc(db, "users", userId), { balance: increment(amount) });
      setPendingDeposits(pendingDeposits.filter(d => d.id !== transactionId));
    } catch (error) { console.error(error); }
  };

  const approveWithdraw = async (transactionId: string) => {
    try {
      await updateDoc(doc(db, "transactions", transactionId), { status: "approved" });
      setPendingWithdraws(pendingWithdraws.filter(d => d.id !== transactionId));
    } catch (error) { console.error(error); }
  };

  const updateStatus = async (teamId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, "registrations", teamId), { status: newStatus });
      setTeams(teams.map(t => t.id === teamId ? { ...t, status: newStatus } : t));
    } catch (error) { console.error(error); }
  };

  const saveRoomDetails = async (teamId: string, roomId: string, roomPass: string) => {
    try {
      await updateDoc(doc(db, "registrations", teamId), { roomId, roomPass });
      alert("রুম আইডি ও পাসওয়ার্ড সেভ হয়েছে!");
      setTeams(teams.map(t => t.id === teamId ? { ...t, roomId, roomPass } : t));
    } catch (error) { console.error(error); }
  };

  const handleCreateTournament = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    try {
      await addDoc(collection(db, "tournaments"), {
        name: formData.get('name'),
        startDate: formData.get('startDate'), 
        time: formData.get('time'), 
        entryFee: Number(formData.get('entryFee')),
        prize1: Number(formData.get('prize1')),
        prize2: Number(formData.get('prize2')),
        prize3: Number(formData.get('prize3')),
        prize4: Number(formData.get('prize4')),
        maxTeams: Number(formData.get('maxTeams')),
        type: "SQUAD",
        status: "upcoming"
      });
      alert("নতুন টুর্নামেন্ট যোগ হয়েছে!");
      e.currentTarget.reset();
    } catch (error) { console.error(error); }
  };

  const handleSavePoints = async (teamName: string, e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const mp = Number(formData.get('mp')) || 0;
    const cd = Number(formData.get('cd')) || 0;
    const pp = Number(formData.get('pp')) || 0;
    const kp = Number(formData.get('kp')) || 0;
    const tp = pp + kp;

    try {
      const existingTeam = pointTable.find(t => t.teamName === teamName);
      if (existingTeam) {
        await updateDoc(doc(db, "pointTable", existingTeam.id), { mp, cd, pp, kp, tp });
      } else {
        await addDoc(collection(db, "pointTable"), { teamName, mp, cd, pp, kp, tp });
      }
      alert(`${teamName} এর পয়েন্ট সেভ হয়েছে!`);
    } catch (error) { console.error(error); }
  };

  if (loading) return <div className="min-h-screen bg-[#0a0a0a] flex justify-center items-center text-white">লোড হচ্ছে...</div>;
  if (!user || !isAdmin) return <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center"><h1 className="text-2xl font-bold text-red-500 mb-4">Access Denied</h1><p>আপনি অ্যাডমিন নন।</p><Link href="/" className="text-blue-400 mt-4 underline">হোম পেজে ফিরে যান</Link></div>;

  const uniqueRegisteredTeams = Array.from(new Set(teams.map(t => t.teamName)));

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
          <h1 className="text-3xl font-black text-purple-500 tracking-wider">ADMIN PANEL</h1>
          <Link href="/" className="bg-[#1a1a1a] hover:bg-[#222] text-gray-300 px-4 py-2 rounded-lg transition border border-gray-700 font-bold">Back to Home</Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {/* প্রাইজমানি আপডেট */}
          <div className="bg-[#111] p-5 rounded-xl border border-gray-800 shadow-lg">
            <h3 className="text-lg font-bold text-green-400 mb-4 flex items-center gap-2"><span className="text-xl">💰</span> প্রাইজমানি আপডেট</h3>
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
              {tournaments.length === 0 && <p className="text-gray-500 text-sm">কোনো টুর্নামেন্ট নেই।</p>}
              {tournaments.map(tour => (
                <div key={tour.id} className="bg-[#1a1a1a] p-4 rounded-lg border border-gray-800">
                  <p className="font-bold text-white mb-3 text-sm">{tour.name}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="text-[10px] text-gray-500">১ম প্রাইজ</label><input type="number" defaultValue={tour.prize1} onBlur={(e) => updatePrize(tour.id, 'prize1', e.target.value)} className="w-full bg-[#0a0a0a] border border-gray-700 rounded p-2 text-white text-sm" /></div>
                    <div><label className="text-[10px] text-gray-500">২য় প্রাইজ</label><input type="number" defaultValue={tour.prize2} onBlur={(e) => updatePrize(tour.id, 'prize2', e.target.value)} className="w-full bg-[#0a0a0a] border border-gray-700 rounded p-2 text-white text-sm" /></div>
                    <div><label className="text-[10px] text-gray-500">৩য় প্রাইজ</label><input type="number" defaultValue={tour.prize3} onBlur={(e) => updatePrize(tour.id, 'prize3', e.target.value)} className="w-full bg-[#0a0a0a] border border-gray-700 rounded p-2 text-white text-sm" /></div>
                    <div><label className="text-[10px] text-gray-500">৪র্থ প্রাইজ</label><input type="number" defaultValue={tour.prize4} onBlur={(e) => updatePrize(tour.id, 'prize4', e.target.value)} className="w-full bg-[#0a0a0a] border border-gray-700 rounded p-2 text-white text-sm" /></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* পয়েন্ট আপডেট */}
          <div className="bg-[#111] p-5 rounded-xl border border-gray-800 shadow-lg">
            <h3 className="text-lg font-bold text-yellow-400 mb-4 flex items-center gap-2"><span className="text-xl">🏆</span> পয়েন্ট আপডেট</h3>
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
              {uniqueRegisteredTeams.length === 0 && <p className="text-gray-500 text-sm">কোনো টিম রেজিস্টার করেনি।</p>}
              {uniqueRegisteredTeams.map((teamName, idx) => {
                const existingData = pointTable.find(t => t.teamName === teamName);
                return (
                <form key={idx} onSubmit={(e) => handleSavePoints(teamName, e)} className="bg-[#1a1a1a] p-3 rounded-lg border border-gray-800 flex flex-col gap-2">
                  <div className="font-bold text-white uppercase text-sm truncate">{teamName}</div>
                  <div className="flex gap-2">
                    <input type="number" name="mp" placeholder="MP" defaultValue={existingData?.mp || ''} className="w-12 bg-[#0a0a0a] border border-gray-700 rounded p-1 text-white text-center text-xs" />
                    <input type="number" name="cd" placeholder="CD" defaultValue={existingData?.cd || ''} className="w-12 bg-[#0a0a0a] border border-gray-700 rounded p-1 text-white text-center text-xs" />
                    <input type="number" name="pp" placeholder="PP" defaultValue={existingData?.pp || ''} className="w-12 bg-[#0a0a0a] border border-gray-700 rounded p-1 text-white text-center text-xs" />
                    <input type="number" name="kp" placeholder="KP" defaultValue={existingData?.kp || ''} className="w-12 bg-[#0a0a0a] border border-gray-700 rounded p-1 text-white text-center text-xs" />
                    <button type="submit" className="bg-yellow-600 hover:bg-yellow-700 text-black px-3 rounded font-bold text-xs ml-auto">Save</button>
                  </div>
                </form>
              )})}
            </div>
          </div>
        </div>

        {/* নতুন টুর্নামেন্ট তৈরি */}
        <div className="bg-[#111] p-5 rounded-xl border border-gray-800 mb-12 shadow-lg">
          <h3 className="text-lg font-bold text-purple-400 mb-4 flex items-center gap-2"><span className="text-xl">➕</span> নতুন টুর্নামেন্ট তৈরি</h3>
          <form onSubmit={handleCreateTournament} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input type="text" name="name" required placeholder="টুর্নামেন্টের নাম" className="bg-[#0a0a0a] border border-gray-700 rounded-lg p-3 text-white text-sm outline-none focus:border-purple-500" />
            <input type="text" name="time" required placeholder="সময় (যেমন: রাত ১১টা)" className="bg-[#0a0a0a] border border-gray-700 rounded-lg p-3 text-white text-sm outline-none focus:border-purple-500" />
            <input type="datetime-local" name="startDate" required className="bg-[#0a0a0a] border border-gray-700 rounded-lg p-3 text-white text-sm outline-none focus:border-purple-500" />
            
            <input type="number" name="entryFee" required placeholder="এন্ট্রি ফি (৳)" className="bg-[#0a0a0a] border border-gray-700 rounded-lg p-3 text-white text-sm outline-none focus:border-purple-500" />
            <input type="number" name="maxTeams" required placeholder="সর্বোচ্চ টিম" className="bg-[#0a0a0a] border border-gray-700 rounded-lg p-3 text-white text-sm outline-none focus:border-purple-500" />
            
            <input type="number" name="prize1" required placeholder="১ম প্রাইজ (৳)" className="bg-[#0a0a0a] border border-gray-700 rounded-lg p-3 text-white text-sm outline-none focus:border-green-500" />
            <input type="number" name="prize2" required placeholder="২য় প্রাইজ (৳)" className="bg-[#0a0a0a] border border-gray-700 rounded-lg p-3 text-white text-sm outline-none focus:border-green-500" />
            <input type="number" name="prize3" required placeholder="৩য় প্রাইজ (৳)" className="bg-[#0a0a0a] border border-gray-700 rounded-lg p-3 text-white text-sm outline-none focus:border-green-500" />
            <input type="number" name="prize4" required placeholder="৪র্থ প্রাইজ (৳)" className="bg-[#0a0a0a] border border-gray-700 rounded-lg p-3 text-white text-sm outline-none focus:border-green-500" />
            
            <button type="submit" className="md:col-span-3 bg-purple-600 hover:bg-purple-500 text-white py-3 rounded-lg font-black tracking-wider transition">টুর্নামেন্ট তৈরি করুন</button>
          </form>
        </div>

        {/* ডিপোজিট এবং উইথড্র */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <div className="bg-[#111] p-5 rounded-xl border border-gray-800 shadow-lg">
            <h3 className="text-lg font-bold text-yellow-400 mb-4">💰 পেন্ডিং ডিপোজিট ({pendingDeposits.length})</h3>
            {pendingDeposits.length === 0 ? <p className="text-sm text-gray-500">কোনো ডিপোজিট নেই।</p> : (
              <div className="space-y-3">
                {pendingDeposits.map(dep => (
                  <div key={dep.id} className="flex justify-between items-center bg-[#1a1a1a] p-3 rounded-lg border border-gray-800">
                    <div>
                      <p className="font-bold text-sm text-white">{dep.userName}</p>
                      <p className="text-green-400 font-bold text-sm">৳ {dep.amount}</p>
                      <p className="text-[10px] text-gray-400 bg-[#0a0a0a] px-1 mt-1 rounded">TrxID: {dep.trxId}</p>
                    </div>
                    <button onClick={() => approveDeposit(dep.id, dep.userId, dep.amount)} className="bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded text-xs font-bold transition">Approve</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-[#111] p-5 rounded-xl border border-gray-800 shadow-lg">
            <h3 className="text-lg font-bold text-red-400 mb-4">💸 পেন্ডিং উইথড্র ({pendingWithdraws.length})</h3>
            {pendingWithdraws.length === 0 ? <p className="text-sm text-gray-500">কোনো উইথড্র নেই।</p> : (
              <div className="space-y-3">
                {pendingWithdraws.map(withd => (
                  <div key={withd.id} className="flex justify-between items-center bg-[#1a1a1a] p-3 rounded-lg border border-gray-800">
                    <div>
                      <p className="font-bold text-sm text-white">{withd.userName}</p>
                      <p className="text-red-400 font-bold text-sm">৳ {withd.amount}</p>
                    </div>
                    <button onClick={() => approveWithdraw(withd.id)} className="bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded text-xs font-bold transition">Approve</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* টিম লিস্ট */}
        <div className="bg-[#111] p-5 rounded-xl border border-gray-800 shadow-lg">
          <h3 className="text-lg font-bold text-blue-400 mb-6 flex items-center gap-2"><span className="text-xl">📋</span> রেজিস্টার্ড টিম ও রুম আইডি ({teams.length})</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {teams.map((team) => (
              <div key={team.id} className="bg-[#1a1a1a] p-4 rounded-xl border border-gray-800 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-600/20 text-purple-400 border border-purple-500/30 rounded-lg flex items-center justify-center font-black text-sm">
                        {team.teamTag}
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-base leading-tight">{team.teamName}</h4>
                        <p className="text-xs text-purple-400">{team.tournamentName}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded text-[10px] font-bold ${team.status === 'approved' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : team.status === 'rejected' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'}`}>{team.status.toUpperCase()}</span>
                  </div>
                  <p className="text-[10px] text-gray-500 mb-3">Captain: {team.captainEmail}</p>
                  
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {team.players?.map((p: any, i: number) => (
                      <div key={i} className="bg-[#0a0a0a] p-2 rounded border border-gray-800/50 text-[11px]">
                        <span className="text-purple-400 font-bold">P{i+1}:</span> {p.name} <br/> <span className="text-gray-500 font-mono">UID: {p.uid}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex gap-2 mb-3">
                    <button onClick={() => updateStatus(team.id, 'approved')} disabled={team.status === 'approved'} className="flex-1 bg-green-600/10 text-green-500 border border-green-500/30 hover:bg-green-600 hover:text-white py-2 rounded font-bold text-xs transition disabled:opacity-50">Approve</button>
                    <button onClick={() => updateStatus(team.id, 'rejected')} disabled={team.status === 'rejected'} className="flex-1 bg-red-600/10 text-red-500 border border-red-500/30 hover:bg-red-600 hover:text-white py-2 rounded font-bold text-xs transition disabled:opacity-50">Reject</button>
                  </div>
                  {team.status === 'approved' && (
                    <div className="flex gap-2 bg-[#0a0a0a] p-2 rounded-lg border border-gray-800">
                      <input type="text" placeholder="Room ID" defaultValue={team.roomId} id={`roomId_${team.id}`} className="flex-1 w-full bg-[#151515] border border-gray-700 rounded p-2 text-xs text-white outline-none focus:border-blue-500" />
                      <input type="text" placeholder="Password" defaultValue={team.roomPass} id={`roomPass_${team.id}`} className="flex-1 w-full bg-[#151515] border border-gray-700 rounded p-2 text-xs text-white outline-none focus:border-blue-500" />
                      <button onClick={() => {
                        const rId = (document.getElementById(`roomId_${team.id}`) as HTMLInputElement).value;
                        const rPass = (document.getElementById(`roomPass_${team.id}`) as HTMLInputElement).value;
                        saveRoomDetails(team.id, rId, rPass);
                      }} className="bg-blue-600 hover:bg-blue-500 text-white px-3 rounded text-xs font-bold transition">Save</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

// Next.js-এর SSR এরর এড়াতে এই ডাইনামিক এক্সপোর্টটি ব্যবহার করা হলো
const DynamicAdmin = dynamic(() => Promise.resolve(AdminPanel), { ssr: false });

export default function Page() {
  return <DynamicAdmin />;
}