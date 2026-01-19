"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, Mail, Phone, MapPin, Calendar, Edit3, Save, X, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { useDocuments } from "@/components/documents-context";
import { getActivities, getDaysActive, addActivity, deleteActivity, type Activity } from "@/lib/activity-tracker";

type ProfileData = {
  name: string;
  email: string;
  phone: string;
  location: string;
  joinDate: string;
  department: string;
  role: string;
  bio: string;
  avatar: string;
};

const defaultProfile: ProfileData = {
  name: "User",
  email: "",
  phone: "",
  location: "",
  joinDate: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
  department: "Enterprise Department",
  role: "User",
  bio: "",
  avatar: "/1.jpg"
};

// Helper untuk localStorage key per user
function getProfileKey(userId: string | null): string {
  return userId ? `user_profile_${userId}` : "user_profile_guest";
}

// Helper untuk format time ago
function getTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  return `${seconds} second${seconds > 1 ? "s" : ""} ago`;
}

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();
  const { documents, recentQueries } = useDocuments(); // Get real-time data
  const [isEditing, setIsEditing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<ProfileData>(defaultProfile);
  const [originalProfile, setOriginalProfile] = useState<ProfileData>(defaultProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Calculate real-time stats
  const documentsProcessed = documents.filter(d => d.status === "Processed").length;
  const queriesMade = recentQueries.length;
  const daysActive = getDaysActive(userId);

  // Get user ID and load profile data
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const uid = data?.user?.id || null;
        
        if (mounted) {
          setUserId(uid);
          
          // Load from localStorage
          const profileKey = getProfileKey(uid);
          const saved = localStorage.getItem(profileKey);
          
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              setProfileData(parsed);
              setOriginalProfile(parsed);
            } catch (e) {
              console.error("Error parsing saved profile:", e);
            }
          } else {
            // If no saved data, try to get from Supabase user metadata
            if (data?.user) {
              const user = data.user;
              const userProfile: ProfileData = {
                name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "User",
                email: user.email || "",
                phone: user.user_metadata?.phone || "",
                location: user.user_metadata?.location || "",
                joinDate: new Date(user.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
                department: user.user_metadata?.department || "Enterprise Department",
                role: user.user_metadata?.role || "User",
                bio: user.user_metadata?.bio || "",
                avatar: user.user_metadata?.avatar || "/1.jpg"
              };
              setProfileData(userProfile);
              setOriginalProfile(userProfile);
            }
          }
          
          // Load activities
          setActivities(getActivities(uid));
        }
      } catch (e) {
        console.error("Error loading profile:", e);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted) {
        const uid = session?.user?.id || null;
        setUserId(uid);
        
        // Reload profile when user changes
        if (uid) {
          const profileKey = getProfileKey(uid);
          const saved = localStorage.getItem(profileKey);
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              setProfileData(parsed);
              setOriginalProfile(parsed);
            } catch (e) {
              console.error("Error parsing saved profile:", e);
            }
          }
        }
        
        // Reload activities
        setActivities(getActivities(uid));
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);
  
  // Update activities when documents or queries change
  useEffect(() => {
    setActivities(getActivities(userId));
  }, [userId, documents, recentQueries]);

  // Cleanup preview URL when component unmounts or avatar changes
  useEffect(() => {
    return () => {
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save to localStorage
      const profileKey = getProfileKey(userId);
      
      // Jika ada avatar preview, pastikan profileData sudah menggunakan URL yang benar
      const finalProfileData = avatarPreview 
        ? { ...profileData, avatar: profileData.avatar } 
        : profileData;
      
      localStorage.setItem(profileKey, JSON.stringify(finalProfileData));
      
      // Track activity
      addActivity(userId, "profile_updated", "Updated profile information");
      
      // Optionally update Supabase user metadata
      if (userId) {
        const { error } = await supabase.auth.updateUser({
          data: {
            full_name: finalProfileData.name,
            name: finalProfileData.name,
            phone: finalProfileData.phone,
            location: finalProfileData.location,
            department: finalProfileData.department,
            role: finalProfileData.role,
            bio: finalProfileData.bio,
            avatar: finalProfileData.avatar,
          }
        });
        
        if (error) {
          console.error("Error updating user metadata:", error);
          // Tetap lanjutkan karena data sudah tersimpan di localStorage
          // Hanya log error, tidak throw agar user tetap bisa save
        }
      }
      
      setOriginalProfile(finalProfileData);
      setProfileData(finalProfileData);
      
      // Cleanup preview URL setelah save
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }
      setAvatarPreview(null);
      setIsEditing(false);
      
      // Reload activities
      setActivities(getActivities(userId));
      
      console.log("Profile saved:", finalProfileData);
      alert("Profile berhasil disimpan!");
    } catch (e: any) {
      console.error("Error saving profile:", e);
      const errorMessage = e?.message || "Terjadi kesalahan saat menyimpan profile. Silakan coba lagi.";
      alert(`Gagal menyimpan profile: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    // Cleanup preview URL
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview);
    }
    setProfileData(originalProfile);
    setAvatarPreview(null);
    setIsEditing(false);
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    // Validasi tipe file
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('Format file tidak didukung. Gunakan JPG, PNG, GIF, atau WebP.');
      return;
    }

    // Validasi ukuran file (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Ukuran file terlalu besar. Maksimal 5MB.');
      return;
    }

    setUploadingAvatar(true);

    try {
      // Create preview
      const previewUrl = URL.createObjectURL(file);
      setAvatarPreview(previewUrl);

      // Upload ke server via API route
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/avatar/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Gagal mengunggah foto');
      }

      // Get public URL from API response
      const publicUrl = result.url;

      // Update profile data dengan URL dari Supabase
      setProfileData({ ...profileData, avatar: publicUrl });

      console.log('Avatar uploaded successfully:', publicUrl);
    } catch (error: any) {
      console.error('Error handling avatar upload:', error);
      let errorMessage = 'Terjadi kesalahan saat mengunggah foto. ';
      
      if (error?.message) {
        errorMessage += error.message;
      } else {
        errorMessage += 'Silakan coba lagi.';
      }
      
      alert(errorMessage);
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }
      setAvatarPreview(null);
    } finally {
      setUploadingAvatar(false);
      // Reset input file
      e.target.value = '';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen page-gradient flex items-center justify-center">
        <div className="text-muted-foreground">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen page-gradient">
      {/* Header */}
      <div className="border-b border-border bg-card/70 glass soft-shadow">
        <div className="flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Button 
              variant="default" 
              size="sm" 
              onClick={() => router.back()}
              className="ring-ambient btn-gradient btn-press"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-xl font-semibold text-gradient">Profile</h1>
          </div>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleCancel}
                  className="ring-ambient"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button 
                  variant="default" 
                  size="sm" 
                  onClick={handleSave}
                  disabled={saving}
                  className="ring-ambient btn-gradient"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Saving..." : "Save"}
                </Button>
              </>
            ) : (
              <Button 
                variant="default" 
                size="sm" 
                onClick={() => setIsEditing(true)}
                className="ring-ambient btn-gradient btn-press"
              >
                <Edit3 className="h-4 w-4 mr-2" />
                Edit Profile
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Card */}
          <div className="lg:col-span-1">
            <Card className="p-6 glass soft-shadow">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="relative">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={avatarPreview || profileData.avatar} />
                    <AvatarFallback className="text-2xl">
                      {profileData.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2) || 'JD'}
                    </AvatarFallback>
                  </Avatar>
                  {isEditing && (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        disabled={uploadingAvatar}
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full btn-gradient cursor-pointer"
                        title="Ubah foto profil"
                      >
                        {uploadingAvatar ? (
                          <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Camera className="h-4 w-4" />
                        )}
                      </Button>
                      <input
                        ref={fileInputRef}
                        id="avatar-upload"
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                        onChange={handleAvatarChange}
                        className="hidden"
                      />
                    </>
                  )}
                </div>
                
                <div className="space-y-2">
                  {isEditing ? (
                    <div className="space-y-2 w-full">
                      <input
                        value={profileData.name}
                        onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                        placeholder="Full name"
                      />
                      <input
                        value={profileData.role}
                        onChange={(e) => setProfileData({ ...profileData, role: e.target.value })}
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                        placeholder="Role"
                      />
                      <input
                        value={profileData.department}
                        onChange={(e) => setProfileData({ ...profileData, department: e.target.value })}
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                        placeholder="Department"
                      />
                    </div>
                  ) : (
                    <>
                      <h2 className="text-2xl font-bold text-gradient">{profileData.name}</h2>
                      <Badge variant="secondary" className="text-sm">
                        {profileData.role}
                      </Badge>
                      <p className="text-sm text-muted-foreground">{profileData.department}</p>
                    </>
                  )}
                </div>

                <div className="w-full space-y-3">
                  {isEditing ? (
                    <div className="space-y-3">
                      <label className="flex items-center gap-3 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <input
                          value={profileData.email}
                          onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                          placeholder="Email"
                          type="email"
                        />
                      </label>
                      <label className="flex items-center gap-3 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <input
                          value={profileData.phone}
                          onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                          placeholder="Phone"
                        />
                      </label>
                      <label className="flex items-center gap-3 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <input
                          value={profileData.location}
                          onChange={(e) => setProfileData({ ...profileData, location: e.target.value })}
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                          placeholder="Location"
                        />
                      </label>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>Joined {profileData.joinDate}</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{profileData.email}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{profileData.phone}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{profileData.location}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>Joined {profileData.joinDate}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </Card>
          </div>

          {/* Profile Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Bio Section */}
            <Card className="p-6 glass soft-shadow">
              <h3 className="text-lg font-semibold mb-4 text-gradient">About</h3>
              {isEditing ? (
                <textarea
                  value={profileData.bio}
                  onChange={(e) => setProfileData({...profileData, bio: e.target.value})}
                  className="w-full h-32 p-3 border border-border rounded-md bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Tell us about yourself..."
                />
              ) : (
                <p className="text-muted-foreground leading-relaxed">{profileData.bio}</p>
              )}
            </Card>

            {/* Activity Stats */}
            <Card className="p-6 glass soft-shadow">
              <h3 className="text-lg font-semibold mb-4 text-gradient">Activity</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 rounded-lg bg-gradient-to-br from-blue-500/10 to-purple-500/10">
                  <div className="text-2xl font-bold text-gradient">{documentsProcessed}</div>
                  <div className="text-sm text-muted-foreground">Documents Processed</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-gradient-to-br from-green-500/10 to-teal-500/10">
                  <div className="text-2xl font-bold text-gradient">{queriesMade}</div>
                  <div className="text-sm text-muted-foreground">Queries Made</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-gradient-to-br from-orange-500/10 to-red-500/10">
                  <div className="text-2xl font-bold text-gradient">{daysActive}</div>
                  <div className="text-sm text-muted-foreground">Days Active</div>
                </div>
              </div>
            </Card>

            {/* Recent Activity */}
            <Card className="p-6 glass soft-shadow">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gradient">Recent Activity</h3>
              </div>
              <div className="space-y-3">
                {activities.length > 0 ? (
                  activities.slice(0, 10).map((activity) => {
                    const timeAgo = getTimeAgo(activity.timestamp);
                    const color = 
                      activity.type === "document_processed" ? "bg-green-500" :
                      activity.type === "query_made" ? "bg-blue-500" :
                      "bg-purple-500";
                    
                    return (
                      <div key={activity.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/40 transition-colors group">
                        <div className={`h-2 w-2 rounded-full ${color}`}></div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{activity.message}</p>
                          <p className="text-xs text-muted-foreground">{timeAgo}</p>
                        </div>
                        <button
                          onClick={() => {
                            deleteActivity(userId, activity.id);
                            setActivities(getActivities(userId));
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-red-500/20 text-red-500 hover:text-red-600"
                          title="Hapus activity"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-3 rounded-lg bg-muted/20 text-sm text-muted-foreground text-center">
                    No activity yet. Start uploading documents or making queries!
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
