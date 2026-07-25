"use client";

import { useState, useRef } from "react";
import dynamic from "next/dynamic";

const SkinViewer = dynamic(() => import("@/components/SkinViewer"), {
  ssr: false,
  loading: () => (
    <div className="w-[300px] h-[400px] bg-[var(--bg)] border border-[var(--border)] rounded-lg flex items-center justify-center">
      <span className="text-[var(--text-muted)] text-sm">Загрузка 3D...</span>
    </div>
  ),
});

export default function SettingsForm({
  initialSkinUrl,
  initialCapeUrl,
  initialNickname,
}: {
  initialSkinUrl?: string | null;
  initialCapeUrl?: string | null;
  initialNickname: string;
}) {
  const [skinUrl, setSkinUrl] = useState<string | null>(initialSkinUrl ?? null);
  const [capeUrl, setCapeUrl] = useState<string | null>(initialCapeUrl ?? null);
  const [nickname, setNickname] = useState(initialNickname);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [nameMessage, setNameMessage] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [newFileUrl, setNewFileUrl] = useState<string | null>(null);
  const [newFileType, setNewFileType] = useState<"skin" | "cape" | null>(null);
  const [pendingSkinUrl, setPendingSkinUrl] = useState<string | null>(null);
  const [pendingCapeUrl, setPendingCapeUrl] = useState<string | null>(null);
  const [cameraResetKey, setCameraResetKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const newFileRef = useRef<File | null>(null);

  function handleFile(file: File) {
    if (!file.name.endsWith(".png")) {
      setMessage("Только PNG файлы");
      return;
    }

    const img = new Image();
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      img.onload = () => {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        let type: "skin" | "cape" | null = null;
        if (w === 64 && h === 64) {
          type = "skin";
        } else if ((w === 64 && h === 32) || (w === 22 && h === 17) || (w === 46 && h === 22)) {
          type = "cape";
        }
        if (!type) {
          setMessage(`Неизвестный формат ${w}x${h}. Скин: 64x64. Плащ: 64x32, 22x17, 46x22.`);
          return;
        }
        if (newFileType === "skin" && type === "cape") {
          setPendingSkinUrl(newFileUrl);
        } else if (newFileType === "cape" && type === "skin") {
          setPendingCapeUrl(newFileUrl);
        }
        setNewFileUrl(dataUrl);
        setNewFileType(type);
        newFileRef.current = file;
        setMessage(null);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(true);
  }

  function handleDragLeave() {
    setDragActive(false);
  }

  async function handleSave() {
    if (!newFileRef.current || !newFileType) return;
    setLoading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append(newFileType === "skin" ? "skin" : "cape", newFileRef.current);

    const endpoint = newFileType === "skin" ? "/api/user/skin" : "/api/user/cape";
    const response = await fetch(endpoint, { method: "POST", body: formData });

    if (response.ok) {
      const data = await response.json();
      if (newFileType === "skin") {
        setSkinUrl(data.skinUrl);
      } else {
        setCapeUrl(data.capeUrl);
      }
      setMessage(newFileType === "skin" ? "Скин обновлён!" : "Плащ обновлён!");
      setNewFileUrl(null);
      setNewFileType(null);
      setPendingSkinUrl(null);
      setPendingCapeUrl(null);
      newFileRef.current = null;
      if (fileInputRef.current) fileInputRef.current.value = "";
    } else {
      const data = await response.json();
      setMessage(data.error || "Ошибка загрузки");
    }

    setLoading(false);
  }

  async function handleSkinRemove() {
    if (!confirm("Вы уверены, что хотите удалить скин?")) return;
    setLoading(true);
    const res = await fetch("/api/user/skin", { method: "DELETE" });
    if (res.ok) {
      setSkinUrl(null);
      setMessage("Скин удалён");
      setTimeout(() => window.location.reload(), 1000);
    }
    setLoading(false);
  }

  async function handleCapeRemove() {
    if (!confirm("Вы уверены, что хотите удалить плащ?")) return;
    setLoading(true);
    const res = await fetch("/api/user/cape", { method: "DELETE" });
    if (res.ok) {
      setCapeUrl(null);
      setMessage("Плащ удалён");
      setTimeout(() => window.location.reload(), 1000);
    }
    setLoading(false);
  }

  async function handleNameChange() {
    if (nickname === initialNickname) {
      setNameMessage("Это уже ваш никнейм");
      return;
    }

    setNameMessage(null);

    const response = await fetch("/api/user/name", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname }),
    });

    const data = await response.json();

    if (response.ok) {
      setNameMessage("Никнейм обновлён!");
      setTimeout(() => window.location.reload(), 1000);
    } else {
      setNameMessage(data.error || "Ошибка");
    }
  }

  const previewSkinUrl = newFileType === "skin" ? newFileUrl : (pendingSkinUrl || skinUrl);
  const previewCapeUrl = newFileType === "cape" ? newFileUrl : (pendingCapeUrl || capeUrl);
  const hasPreview = previewSkinUrl || previewCapeUrl;

  return (
    <div className="space-y-6">
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Никнейм</h2>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-sm text-[var(--text-secondary)] mb-2">
              Ваш никнейм
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              minLength={3}
              maxLength={16}
              className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--text)] text-sm focus:outline-none focus:border-[#7c3aed]"
            />
          </div>
          <button
            onClick={handleNameChange}
            disabled={nickname === initialNickname || nickname.length < 3}
            className="px-4 py-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Изменить
          </button>
        </div>
        {nameMessage && (
          <p className={`mt-2 text-sm ${nameMessage.includes("Ошибка") || nameMessage.includes("уже") ? "text-red-500" : "text-green-500"}`}>
            {nameMessage}
          </p>
        )}
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          3-16 символов: буквы, цифры, подчёркивание
        </p>
      </div>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-2">Внешний вид</h2>
        <p className="text-[var(--text-secondary)] text-sm mb-6">
          Загрузите PNG файл скина (64x64) или плаща (64x32, 22x17, 46x22). Сайт определит тип автоматически.
        </p>

        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-shrink-0">
            {hasPreview ? (
              <SkinViewer
                skinUrl={previewSkinUrl || ""}
                capeUrl={previewCapeUrl}
                width={300}
                height={400}
                showControls={!!previewSkinUrl}
                resetKey={cameraResetKey}
              />
            ) : (
              <div className="w-[300px] h-[400px] bg-[var(--bg)] border border-[var(--border)] rounded-lg flex items-center justify-center">
                <span className="text-[var(--text-muted)] text-sm">
                  У вас нет скина и плаща
                </span>
              </div>
            )}
            <div className="flex gap-2 mt-2">
              {initialSkinUrl && (
                <button
                  onClick={handleSkinRemove}
                  disabled={loading}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  Удалить скин
                </button>
              )}
              {initialCapeUrl && (
                <button
                  onClick={handleCapeRemove}
                  disabled={loading}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  Удалить плащ
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 space-y-4">
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                dragActive
                  ? "border-[#7c3aed] bg-[#7c3aed]/10"
                  : "border-[var(--border)] hover:border-[#7c3aed]/50"
              }`}
            >
              <p className="text-[var(--text)] text-sm mb-1">
                Перетащите файл сюда или нажмите для выбора
              </p>
              <p className="text-[var(--text-muted)] text-xs">
                Только .png (скин или плащ Minecraft)
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".png"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
              className="hidden"
            />

            {newFileType && (
              <p className="text-green-500 text-sm">
                {newFileType === "skin" ? "Скин" : "Плащ"} выбран и готов к загрузке
              </p>
            )}

            {message && (
              <p className={`text-sm ${message.includes("Ошибка") || message.includes("Неизвестный") || message.includes("Только") ? "text-red-500" : "text-green-500"}`}>
                {message}
              </p>
            )}

            {newFileUrl && (
              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="flex-1 py-3 bg-[#7c3aed] hover:bg-[#6d28d9] text-white rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Сохранение..." : "Сохранить"}
                </button>
                <button
                  onClick={() => {
                    setNewFileUrl(null);
                    setNewFileType(null);
                    setPendingSkinUrl(null);
                    setPendingCapeUrl(null);
                    setCameraResetKey((k) => k + 1);
                    newFileRef.current = null;
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  disabled={loading}
                  className="px-4 py-3 bg-[var(--bg)] border border-[var(--border)] hover:border-[var(--text-muted)] text-[var(--text)] rounded-lg text-sm transition-colors disabled:opacity-50"
                  title="Сбросить"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M20.49 9A9 9 0 0 0 5.64 5.64L4 4m16 16l-1.64-1.64A9 9 0 0 1 3.51 15" />
                  </svg>
                </button>
              </div>
            )}

            <div className="bg-[var(--bg)] border border-[var(--border)] rounded-lg p-4">
              <h3 className="text-sm font-medium mb-2">Где скачать:</h3>
              <ul className="text-xs text-[var(--text-secondary)] space-y-1 list-disc list-inside">
                <li>Скины: <a href="https://namemc.com/" target="_blank" rel="noopener" className="text-[#7c3aed] hover:underline">namemc.com</a></li>
                <li>Плащи: <a href="https://laby.net/ru/cloaks" target="_blank" rel="noopener" className="text-[#7c3aed] hover:underline">laby.net</a></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
