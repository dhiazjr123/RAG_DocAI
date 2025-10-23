<<<<<<< HEAD
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function ProfilePage() {
  return (
    <main className="p-4 md:p-6 space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="bg-card/70 glass soft-shadow lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Profil</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src="/1.jpg" />
                <AvatarFallback>JD</AvatarFallback>
              </Avatar>
              <div>
                <div className="text-sm font-medium">User</div>
                <div className="text-xs text-muted-foreground">user@example.com</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-muted-foreground">Nama</div>
                <div className="text-sm">User</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Telepon</div>
                <div className="text-sm">-</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Jabatan</div>
                <div className="text-sm">-</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Organisasi</div>
                <div className="text-sm">-</div>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button size="sm" className="btn-gradient">Ubah Profil</Button>
              <Button size="sm" variant="outline">Ganti Foto</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/70 glass soft-shadow lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Keamanan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Kata Sandi</div>
                <div className="text-sm">********</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Autentikasi</div>
                <div className="text-sm">Email</div>
              </div>
            </div>
            <div className="mt-4">
              <Button size="sm" variant="outline">Ubah Kata Sandi</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}


=======
// app/profile/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, Camera, Mail, Phone, MapPin, Calendar, Edit3, Save, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ProfilePage() {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState({
    name: "John Doe",
    email: "john.doe@example.com",
    phone: "+62 812-3456-7890",
    location: "Jakarta, Indonesia",
    joinDate: "January 15, 2024",
    department: "Enterprise Department",
    role: "Senior Developer",
    bio: "Passionate developer with expertise in AI and machine learning. Love building innovative solutions that make a difference.",
    avatar: "/1.jpg"
  });

  const handleSave = () => {
    setIsEditing(false);
    // Here you would typically save to your backend
    console.log("Profile saved:", profileData);
  };

  const handleCancel = () => {
    setIsEditing(false);
    // Reset to original data if needed
  };

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
              className="ring-ambient btn-gradient"
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
                  className="ring-ambient btn-gradient"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
              </>
            ) : (
              <Button 
                variant="default" 
                size="sm" 
                onClick={() => setIsEditing(true)}
                className="ring-ambient btn-gradient"
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
                    <AvatarImage src={profileData.avatar} />
                    <AvatarFallback className="text-2xl">JD</AvatarFallback>
                  </Avatar>
                  {isEditing && (
                    <Button
                      size="sm"
                      className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full btn-gradient"
                    >
                      <Camera className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-gradient">{profileData.name}</h2>
                  <Badge variant="secondary" className="text-sm">
                    {profileData.role}
                  </Badge>
                  <p className="text-sm text-muted-foreground">{profileData.department}</p>
                </div>

                <div className="w-full space-y-3">
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
                  <div className="text-2xl font-bold text-gradient">24</div>
                  <div className="text-sm text-muted-foreground">Documents Processed</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-gradient-to-br from-green-500/10 to-teal-500/10">
                  <div className="text-2xl font-bold text-gradient">156</div>
                  <div className="text-sm text-muted-foreground">Queries Made</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-gradient-to-br from-orange-500/10 to-red-500/10">
                  <div className="text-2xl font-bold text-gradient">8</div>
                  <div className="text-sm text-muted-foreground">Days Active</div>
                </div>
              </div>
            </Card>

            {/* Recent Activity */}
            <Card className="p-6 glass soft-shadow">
              <h3 className="text-lg font-semibold mb-4 text-gradient">Recent Activity</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <div className="h-2 w-2 rounded-full bg-green-500"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Processed document "Project Report.pdf"</p>
                    <p className="text-xs text-muted-foreground">2 hours ago</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Asked query about "machine learning algorithms"</p>
                    <p className="text-xs text-muted-foreground">5 hours ago</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <div className="h-2 w-2 rounded-full bg-purple-500"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Updated profile information</p>
                    <p className="text-xs text-muted-foreground">1 day ago</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
>>>>>>> fdd87e3 (WIP: simpan perubahan lokal sebelum rebase)
