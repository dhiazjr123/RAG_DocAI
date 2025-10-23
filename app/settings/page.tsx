// app/settings/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Bell, Shield, Palette, Globe, Database, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState({
    notifications: {
      email: true,
      push: false,
      sms: false,
      weekly: true
    },
    privacy: {
      profileVisibility: "public",
      dataSharing: false,
      analytics: true
    },
    appearance: {
      theme: "system",
      language: "en",
      fontSize: "medium"
    },
    ai: {
      model: "gpt-4o-mini",
      temperature: 0.7,
      maxTokens: 2000,
      autoSave: true
    },
    data: {
      autoBackup: true,
      retentionPeriod: "1year",
      exportFormat: "json"
    }
  });

  const handleSave = () => {
    console.log("Settings saved:", settings);
    // Here you would typically save to your backend
  };

  const updateSetting = (category: string, key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category as keyof typeof prev],
        [key]: value
      }
    }));
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
            <h1 className="text-xl font-semibold text-gradient">Settings</h1>
          </div>
          <Button 
            variant="default" 
            size="sm" 
            onClick={handleSave}
            className="ring-ambient btn-gradient"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Notifications */}
          <Card className="p-6 glass soft-shadow">
            <div className="flex items-center gap-3 mb-6">
              <Bell className="h-5 w-5 text-gradient" />
              <h3 className="text-lg font-semibold text-gradient">Notifications</h3>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Email Notifications</p>
                  <p className="text-sm text-muted-foreground">Receive updates via email</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notifications.email}
                    onChange={(e) => updateSetting('notifications', 'email', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Push Notifications</p>
                  <p className="text-sm text-muted-foreground">Browser push notifications</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notifications.push}
                    onChange={(e) => updateSetting('notifications', 'push', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Weekly Summary</p>
                  <p className="text-sm text-muted-foreground">Get weekly activity reports</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notifications.weekly}
                    onChange={(e) => updateSetting('notifications', 'weekly', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
            </div>
          </Card>

          {/* Privacy & Security */}
          <Card className="p-6 glass soft-shadow">
            <div className="flex items-center gap-3 mb-6">
              <Shield className="h-5 w-5 text-gradient" />
              <h3 className="text-lg font-semibold text-gradient">Privacy & Security</h3>
            </div>
            <div className="space-y-4">
              <div>
                <p className="font-medium mb-2">Profile Visibility</p>
                <select
                  value={settings.privacy.profileVisibility}
                  onChange={(e) => updateSetting('privacy', 'profileVisibility', e.target.value)}
                  className="w-full p-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                  <option value="friends">Friends Only</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Data Sharing</p>
                  <p className="text-sm text-muted-foreground">Allow data sharing for improvements</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.privacy.dataSharing}
                    onChange={(e) => updateSetting('privacy', 'dataSharing', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Analytics</p>
                  <p className="text-sm text-muted-foreground">Help improve our service</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.privacy.analytics}
                    onChange={(e) => updateSetting('privacy', 'analytics', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
            </div>
          </Card>

          {/* Appearance */}
          <Card className="p-6 glass soft-shadow">
            <div className="flex items-center gap-3 mb-6">
              <Palette className="h-5 w-5 text-gradient" />
              <h3 className="text-lg font-semibold text-gradient">Appearance</h3>
            </div>
            <div className="space-y-4">
              <div>
                <p className="font-medium mb-2">Theme</p>
                <select
                  value={settings.appearance.theme}
                  onChange={(e) => updateSetting('appearance', 'theme', e.target.value)}
                  className="w-full p-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">System</option>
                </select>
              </div>

              <div>
                <p className="font-medium mb-2">Language</p>
                <select
                  value={settings.appearance.language}
                  onChange={(e) => updateSetting('appearance', 'language', e.target.value)}
                  className="w-full p-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="en">English</option>
                  <option value="id">Indonesian</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                </select>
              </div>

              <div>
                <p className="font-medium mb-2">Font Size</p>
                <select
                  value={settings.appearance.fontSize}
                  onChange={(e) => updateSetting('appearance', 'fontSize', e.target.value)}
                  className="w-full p-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </div>
            </div>
          </Card>

          {/* AI Settings */}
          <Card className="p-6 glass soft-shadow">
            <div className="flex items-center gap-3 mb-6">
              <Zap className="h-5 w-5 text-gradient" />
              <h3 className="text-lg font-semibold text-gradient">AI Settings</h3>
            </div>
            <div className="space-y-4">
              <div>
                <p className="font-medium mb-2">Model</p>
                <select
                  value={settings.ai.model}
                  onChange={(e) => updateSetting('ai', 'model', e.target.value)}
                  className="w-full p-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="gpt-4o-mini">GPT-4o Mini</option>
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                </select>
              </div>

              <div>
                <p className="font-medium mb-2">Temperature: {settings.ai.temperature}</p>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={settings.ai.temperature}
                  onChange={(e) => updateSetting('ai', 'temperature', parseFloat(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>More Focused</span>
                  <span>More Creative</span>
                </div>
              </div>

              <div>
                <p className="font-medium mb-2">Max Tokens</p>
                <input
                  type="number"
                  value={settings.ai.maxTokens}
                  onChange={(e) => updateSetting('ai', 'maxTokens', parseInt(e.target.value))}
                  className="w-full p-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Auto Save</p>
                  <p className="text-sm text-muted-foreground">Automatically save conversations</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.ai.autoSave}
                    onChange={(e) => updateSetting('ai', 'autoSave', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
            </div>
          </Card>

          {/* Data Management */}
          <Card className="p-6 glass soft-shadow lg:col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <Database className="h-5 w-5 text-gradient" />
              <h3 className="text-lg font-semibold text-gradient">Data Management</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Auto Backup</p>
                    <p className="text-sm text-muted-foreground">Automatically backup your data</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.data.autoBackup}
                      onChange={(e) => updateSetting('data', 'autoBackup', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                <div>
                  <p className="font-medium mb-2">Retention Period</p>
                  <select
                    value={settings.data.retentionPeriod}
                    onChange={(e) => updateSetting('data', 'retentionPeriod', e.target.value)}
                    className="w-full p-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="30days">30 Days</option>
                    <option value="6months">6 Months</option>
                    <option value="1year">1 Year</option>
                    <option value="forever">Forever</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="font-medium mb-2">Export Format</p>
                  <select
                    value={settings.data.exportFormat}
                    onChange={(e) => updateSetting('data', 'exportFormat', e.target.value)}
                    className="w-full p-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="json">JSON</option>
                    <option value="csv">CSV</option>
                    <option value="pdf">PDF</option>
                    <option value="txt">TXT</option>
                  </select>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 ring-ambient">
                    <Database className="h-4 w-4 mr-2" />
                    Export Data
                  </Button>
                  <Button variant="outline" className="flex-1 ring-ambient">
                    <Globe className="h-4 w-4 mr-2" />
                    Import Data
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
