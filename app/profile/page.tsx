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


