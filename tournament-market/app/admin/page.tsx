'use client';

import { useState, useEffect } from 'react';
import { auth, googleProvider } from '../firebase';
import { signInWithPopup, onAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, collection, getDocs, doc, updateDoc, addDoc, 
  onSnapshot, increment, query, where
} from 'firebase/firestore';
import Link from 'next/link';
import dynamic from 'next/dynamic';

function AdminPanelContent() {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview'); // নতুন ট্যাব সিস্টেম

  // ডেটা স্টেট
  const [teams, setTeams] = useState<any[]>([]);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
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

      const usersSnap = await getDocs(collection(db, "users"));
      const usersData: any[] = [];
      usersSnap.forEach((doc) => { usersData.push({ id: doc.id, ...doc.data() }); });
      setUsersList(usersData);

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

  const updateTournamentDetails = async (tourId: string, field: string, value: string | number) => {
    try {
      const tourRef = doc(db, "tournaments", tourId);
      await updateDoc(tourRef, { [field]: value });
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

  if (loading) return <div className="min-h-screen bg-[#0a0a0a] flex justify-center items-center text-white font-bold text-xl">লোড হচ্ছে...</div>;
  if (!user || !isAdmin) return <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center"><h1 className="text-2xl font-bold text-red-500 mb-4">Access Denied</h1><p>আপনি অ্যাডমিন নন।</p><Link href="/" className="text-blue-400 mt-4 underline">হোম পেজে ফিরে যান</Link></div>;

  const uniqueRegisteredTeams = Array.from(new Set(teams.map(t => t.teamName)));
  
  // ড্যাশবোর্ডের হিসাব
  const totalBalance = usersList.reduce((acc, curr) => acc + (curr.balance || 0), 0);
  const totalPendingDep = pendingDeposits.reduce((acc, curr) => acc + (curr.amount || 0), 0);

  return (
    <div className="min-h-screen bg-[#050505] text-gray-200 font-sans">
      {/* টপ বার */}
      <div className="bg-[#111111] border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center font-black text-xl text-white shadow-lg shadow-purple-600/30">
              T
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-wide">Admin Dashboard</h1>
              <p className="text-xs text-gray-500">Tournament Market BD</p>
            </div>
          </div>
          <Link href="/" className="bg-[#1a1a1a] hover:bg-gray-800 text-gray-300 px-4 py-2 rounded-lg text-sm transition border border-gray-700 font-semibold flex items-center gap-2">
            <span>↗</span> Visit Website
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        
        {/* ট্যাব মেনু */}
        <div className="flex flex-wrap gap-2 mb-8 bg-[#111] p-1.5 rounded-xl border border-gray-800 w-fit">
          {['overview', 'tournaments', 'registrations', 'users'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2.5 rounded-lg text-sm font-bold capitalize transition ${
                activeTab === tab ? 'bg-purple-600 text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-[#222]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ================= 1. OVERVIEW TAB ================= */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* স্ট্যাটস কার্ড */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#111] p-5 rounded-xl border border-gray-800 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/10 rounded-bl-full"></div>
                <p className="text-gray-400 text-xs uppercase font-bold mb-1">Total Users</p>
                <p className="text-3xl font-black text-white">{usersList.length}</p>
              </div>
              <div className="bg-[#111] p-5 rounded-xl border border-gray-800 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-green-500/10 rounded-bl-full"></div>
                <p className="text-gray-400 text-xs uppercase font-bold mb-1">Total Teams</p>
                <p className="text-3xl font-black text-white">{teams.length}</p>
              </div>
              <div className="bg-[#111] p-5 rounded-xl border border-gray-800 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-yellow-500/10 rounded-bl-full"></div>
                <p className="text-gray-400 text-xs uppercase font-bold mb-1">Total Wallet Balance</p>
                <p className="text-3xl font-black text-green-400">৳ {totalBalance}</p>
              </div>
              <div className="bg-[#111] p-5 rounded-xl border border-gray-800 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/10 rounded-bl-full"></div>
                <p className="text-gray-400 text-xs uppercase font-bold mb-1">Pending Deposits</p>
                <p className="text-3xl font-black text-red-400">৳ {totalPendingDep}</p>
              </div>
            </div>

            {/* পেন্ডিং ট্রানজেকশন */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-[#111] p-5 rounded-xl border border-gray-800">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-white">Pending Deposits</h3>
                  <span className="bg-yellow-500/20 text-yellow-500 text-xs px-2 py-1 rounded-full">{pendingDeposits.length}</span>
                </div>
                {pendingDeposits.length === 0 ? <p className="text-gray-500 text-sm">No pending deposits.</p> : (
                  <div className="space-y-3">
                    {pendingDeposits.map(dep => (
                      <div key={dep.id} className="flex justify-between items-center bg-[#1a1a1a] p-3 rounded-lg border border-gray-800">
                        <div>
                          <p className="font-bold text-sm text-white">{dep.userName}</p>
                          <p className="text-green-400 font-bold text-sm">৳ {dep.amount}</p>
                          <p className="text-[10px] text-gray-500">TrxID: {dep.trxId}</p>
                        </div>
                        <button onClick={() => approveDeposit(dep.id, dep.userId, dep.amount)} className="bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded text-xs font-bold transition">Approve</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-[#111] p-5 rounded-xl border border-gray-800">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-white">Pending Withdraws</h3>
                  <span className="bg-red-500/20 text-red-500 text-xs px-2 py-1 rounded-full">{pendingWithdraws.length}</span>
                </div>
                {pendingWithdraws.length === 0 ? <p className="text-gray-500 text-sm">No pending withdraws.</p> : (
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
          </div>
        )}

        {/* ================= 2. TOURNAMENTS TAB ================= */}
        {activeTab === 'tournaments' && (
          <div className="space-y-8">
            {/* নতুন টুর্নামেন্ট ফর্ম */}
            <div className="bg-[#111] p-6 rounded-xl border border-gray-800 shadow-lg">
              <h3 className="text-lg font-bold text-purple-400 mb-4">Create New Tournament</h3>
              <form onSubmit={handleCreateTournament} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input type="text" name="name" required placeholder="Tournament Name" className="bg-[#050505] border border-gray-700 rounded-lg p-3 text-white text-sm outline-none focus:border-purple-500" />
                <input type="text" name="time" required placeholder="Time (e.g. 11 PM)" className="bg-[#050505] border border-gray-700 rounded-lg p-3 text-white text-sm outline-none focus:border-purple-500" />
                <input type="datetime-local" name="startDate" required className="bg-[#050505] border border-gray-700 rounded-lg p-3 text-white text-sm outline-none focus:border-purple-500" />
                <input type="number" name="entryFee" required placeholder="Entry Fee (৳)" className="bg-[#050505] border border-gray-700 rounded-lg p-3 text-white text-sm outline-none focus:border-purple-500" />
                <input type="number" name="maxTeams" required placeholder="Max Teams" className="bg-[#050505] border border-gray-700 rounded-lg p-3 text-white text-sm outline-none focus:border-purple-500" />
                <input type="number" name="prize1" required placeholder="1st Prize (৳)" className="bg-[#050505] border border-gray-700 rounded-lg p-3 text-white text-sm outline-none focus:border-green-500" />
                <input type="number" name="prize2" required placeholder="2nd Prize (৳)" className="bg-[#050505] border border-gray-700 rounded-lg p-3 text-white text-sm outline-none focus:border-green-500" />
                <input type="number" name="prize3" required placeholder="3rd Prize (৳)" className="bg-[#050505] border border-gray-700 rounded-lg p-3 text-white text-sm outline-none focus:border-green-500" />
                <input type="number" name="prize4" required placeholder="4th Prize (৳)" className="bg-[#050505] border border-gray-700 rounded-lg p-3 text-white text-sm outline-none focus:border-green-500" />
                <button type="submit" className="md:col-span-3 bg-purple-600 hover:bg-purple-500 text-white py-3 rounded-lg font-black tracking-wider transition mt-2">Create Tournament</button>
              </form>
            </div>

            {/* এক্সিস্টিং টুর্নামেন্ট এডিট */}
            <div>
              <h3 className="text-lg font-bold text-gray-200 mb-4 border-b border-gray-800 pb-2">Manage Tournaments & Points</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {tournaments.map(tour => (
                  <div key={tour.id} className="bg-[#111] p-5 rounded-xl border border-gray-800">
                    <div className="flex justify-between items-center mb-4">
                      <p className="font-bold text-white text-lg">{tour.name}</p>
                      <span className="text-xs text-purple-400 bg-purple-500/10 px-2 py-1 rounded">{tour.time}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-6">
                      <div><label className="text-[10px] text-gray-500 uppercase">1st Prize</label><input type="number" defaultValue={tour.prize1} onBlur={(e) => updateTournamentDetails(tour.id, 'prize1', Number(e.target.value))} className="w-full bg-[#050505] border border-gray-700 rounded p-2 text-white text-sm" /></div>
                      <div><label className="text-[10px] text-gray-500 uppercase">2nd Prize</label><input type="number" defaultValue={tour.prize2} onBlur={(e) => updateTournamentDetails(tour.id, 'prize2', Number(e.target.value))} className="w-full bg-[#050505] border border-gray-700 rounded p-2 text-white text-sm" /></div>
                      <div><label className="text-[10px] text-gray-500 uppercase">Entry Fee</label><input type="number" defaultValue={tour.entryFee} onBlur={(e) => updateTournamentDetails(tour.id, 'entryFee', Number(e.target.value))} className="w-full bg-[#050505] border border-gray-700 rounded p-2 text-white text-sm" /></div>
                      <div><label className="text-[10px] text-gray-500 uppercase">Max Teams</label><input type="number" defaultValue={tour.maxTeams} onBlur={(e) => updateTournamentDetails(tour.id, 'maxTeams', Number(e.target.value))} className="w-full bg-[#050505] border border-gray-700 rounded p-2 text-white text-sm" /></div>
                    </div>

                    {/* পয়েন্ট টেবিল আপডেট */}
                    <div className="border-t border-gray-800 pt-4">
                      <p className="text-xs font-bold text-gray-400 mb-3 uppercase">Update Points</p>
                      <div className="space-y-2">
                        {uniqueRegisteredTeams.map((teamName, idx) => {
                          const existingData = pointTable.find(t => t.teamName === teamName);
                          return (
                          <form key={idx} onSubmit={(e) => handleSavePoints(teamName, e)} className="bg-[#1a1a1a] p-2 rounded-lg flex items-center gap-2">
                            <div className="w-24 text-xs font-bold text-white truncate">{teamName}</div>
                            <input type="number" name="mp" placeholder="MP" defaultValue={existingData?.mp || ''} className="w-10 bg-[#050505] border border-gray-700 rounded p-1 text-white text-center text-xs" />
                            <input type="number" name="cd" placeholder="CD" defaultValue={existingData?.cd || ''} className="w-10 bg-[#050505] border border-gray-700 rounded p-1 text-white text-center text-xs" />
                            <input type="number" name="pp" placeholder="PP" defaultValue={existingData?.pp || ''} className="w-10 bg-[#050505] border border-gray-700 rounded p-1 text-white text-center text-xs" />
                            <input type="number" name="kp" placeholder="KP" defaultValue={existingData?.kp || ''} className="w-10 bg-[#050505] border border-gray-700 rounded p-1 text-white text-center text-xs" />
                            <button type="submit" className="bg-yellow-500 hover:bg-yellow-600 text-black px-2 py-1 rounded font-bold text-xs ml-auto">Save</button>
                          </form>
                        )})}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= 3. REGISTRATIONS TAB ================= */}
        {activeTab === 'registrations' && (
          <div className="bg-[#111] rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#1a1a1a] text-gray-400 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3">Team</th>
                  <th className="px-4 py-3">Tournament</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Room Info</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {teams.map((team) => (
                  <tr key={team.id} className="hover:bg-[#151515]">
                    <td className="px-4 py-3">
                      <div className="font-bold text-white">{team.teamName}</div>
                      <div className="text-xs text-gray-500">Tag: {team.teamTag}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-300">{team.tournamentName}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold ${team.status === 'approved' ? 'bg-green-500/10 text-green-400' : team.status === 'rejected' ? 'bg-red-500/10 text-red-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
                        {team.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => updateStatus(team.id, 'approved')} className="text-xs bg-green-600/20 text-green-400 px-2 py-1 rounded hover:bg-green-600 hover:text-white transition">Approve</button>
                        <button onClick={() => updateStatus(team.id, 'rejected')} className="text-xs bg-red-600/20 text-red-400 px-2 py-1 rounded hover:bg-red-600 hover:text-white transition">Reject</button>
                      </div>
                      {team.status === 'approved' && (
                        <div className="flex gap-1 mt-2">
                          <input type="text" placeholder="Room ID" defaultValue={team.roomId} id={`roomId_${team.id}`} className="w-20 bg-[#050505] border border-gray-700 rounded p-1 text-xs text-white" />
                          <input type="text" placeholder="Pass" defaultValue={team.roomPass} id={`roomPass_${team.id}`} className="w-20 bg-[#050505] border border-gray-700 rounded p-1 text-xs text-white" />
                          <button onClick={() => {
                            const rId = (document.getElementById(`roomId_${team.id}`) as HTMLInputElement).value;
                            const rPass = (document.getElementById(`roomPass_${team.id}`) as HTMLInputElement).value;
                            saveRoomDetails(team.id, rId, rPass);
                          }} className="bg-blue-600 text-white px-2 rounded text-xs">Set</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ================= 4. USERS TAB ================= */}
        {activeTab === 'users' && (
          <div className="bg-[#111] rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#1a1a1a] text-gray-400 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3">User Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Balance</th>
                  <th className="px-4 py-3">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {usersList.map((u) => (
                  <tr key={u.id} className="hover:bg-[#151515]">
                    <td className="px-4 py-3 font-bold text-white">{u.name || 'Unknown'}</td>
                    <td className="px-4 py-3 text-gray-400">{u.email}</td>
                    <td className="px-4 py-3 font-bold text-green-400">৳ {u.balance || 0}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">Active</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  );
}

const DynamicAdmin = dynamic(() => Promise.resolve(AdminPanelContent), { ssr: false });

export default function Page() {
  return <DynamicAdmin />;
}