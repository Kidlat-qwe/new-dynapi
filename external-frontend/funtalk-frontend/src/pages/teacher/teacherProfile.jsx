import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import { API_BASE_URL } from '@/config/api.js';

const FILE_META = {
  video_intro: {
    label: 'Intro video',
    type: 'video',
    actionLabel: 'Watch video',
    formKey: 'introVideo',
    accept: 'video/*',
  },
  audio_intro: {
    label: 'Intro audio',
    type: 'audio',
    actionLabel: 'Listen audio',
    formKey: 'introAudio',
    accept: 'audio/*',
  },
  docs: {
    label: 'Curriculum vitae',
    type: 'document',
    actionLabel: 'View CV',
    formKey: 'curriculumVitae',
    accept: '.pdf,.doc,.docx',
  },
};

const canPreviewDocumentInline = (url) => /\.pdf(\?.*)?$/i.test(String(url || ''));
const ABOUT_MAX_CHARACTERS = 500;

/** Solid brown from app header (matches primary tone; no gradient on profile banner) */
const PROFILE_BANNER = '#A7816D';

const TeacherProfile = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [profile, setProfile] = useState(null);
  const [formData, setFormData] = useState({
    introText: '',
    profilePhoto: null,
    curriculumVitae: null,
    introAudio: null,
    introVideo: null,
  });
  const [message, setMessage] = useState('');
  const [previewModal, setPreviewModal] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (!token || !userData) {
      navigate('/login');
      return;
    }
    try {
      const parsed = JSON.parse(userData);
      if (parsed.userType !== 'teacher') {
        navigate('/login');
        return;
      }
      setUser(parsed);
    } catch {
      navigate('/login');
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  useEffect(() => {
    const handleProfilePictureUpdated = (event) => {
      const nextProfilePicture = String(event?.detail?.profilePicture || '').trim();
      if (!nextProfilePicture) return;
      setProfile((prev) => {
        if (!prev) return prev;
        return { ...prev, profile_picture: nextProfilePicture };
      });
    };

    window.addEventListener('funtalk:profile-picture-updated', handleProfilePictureUpdated);
    return () => {
      window.removeEventListener('funtalk:profile-picture-updated', handleProfilePictureUpdated);
    };
  }, []);

  const toAbsoluteUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `${API_BASE_URL.replace('/api', '')}${url}`;
  };

  const openPreviewModal = ({ type, title, url, text }) => {
    setPreviewModal({ type, title, url: url || '', text: text || '' });
  };

  const getFileName = (url) => {
    if (!url) return '';
    const lastSlash = String(url).lastIndexOf('/');
    const filename = lastSlash > -1 ? String(url).substring(lastSlash + 1) : String(url);
    return filename.split('?')[0];
  };

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/teachers/me/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setProfile(data.data.profile);
        setFormData((prev) => ({
          ...prev,
          introText: data.data.profile?.description || '',
        }));
      } else {
        setMessage(data.message || 'Unable to load profile');
      }
    } catch {
      setMessage('Network error while loading profile');
    }
  };

  const handleFileChange = (e) => {
    const { name, files } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: files?.[0] || null,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage('');
    try {
      const token = localStorage.getItem('token');
      const payload = new FormData();
      payload.append('introText', formData.introText || '');
      if (formData.profilePhoto) payload.append('profilePhoto', formData.profilePhoto);
      if (formData.curriculumVitae) payload.append('curriculumVitae', formData.curriculumVitae);
      if (formData.introAudio) payload.append('introAudio', formData.introAudio);
      if (formData.introVideo) payload.append('introVideo', formData.introVideo);

      const response = await fetch(`${API_BASE_URL}/teachers/me/profile`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: payload,
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setMessage(data.message || 'Failed to update profile');
        return;
      }
      setMessage('Profile updated successfully');
      setProfile(data.data.profile);
      setFormData((prev) => ({
        ...prev,
        profilePhoto: null,
        curriculumVitae: null,
        introAudio: null,
        introVideo: null,
      }));
    } catch {
      setMessage('Network error while updating profile');
    } finally {
      setIsSaving(false);
    }
  };

  const aboutText = String(formData.introText || '');
  const hasPendingProfilePhoto = Boolean(formData.profilePhoto);
  const hasPendingCv = Boolean(formData.curriculumVitae);
  const hasPendingIntroAudio = Boolean(formData.introAudio);
  const hasPendingIntroVideo = Boolean(formData.introVideo);
  const hasPendingFiles = Boolean(hasPendingProfilePhoto || hasPendingCv || hasPendingIntroAudio || hasPendingIntroVideo);
  const hasAboutChanged = aboutText !== String(profile?.description || '');
  const hasUnsavedChanges = hasPendingFiles || hasAboutChanged;

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const handleDocumentNavigation = async (event) => {
      if (!hasUnsavedChanges) return;
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!anchor) return;
      if (anchor.getAttribute('target') === '_blank') return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#')) return;

      let targetUrl;
      try {
        targetUrl = new URL(href, window.location.origin);
      } catch {
        return;
      }

      if (targetUrl.origin !== window.location.origin) return;
      if (targetUrl.pathname === window.location.pathname && targetUrl.search === window.location.search) return;

      event.preventDefault();
      event.stopPropagation();

      const confirmLeave = typeof window.appConfirm === 'function'
        ? await window.appConfirm('You have unsaved changes. Leave this page without saving?', {
            confirmText: 'Leave',
            cancelText: 'Stay',
          })
        : false;

      if (confirmLeave) {
        navigate(`${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`);
      }
    };

    document.addEventListener('click', handleDocumentNavigation, true);
    return () => document.removeEventListener('click', handleDocumentNavigation, true);
  }, [hasUnsavedChanges, navigate]);

  if (isLoading || !user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={user} />
      <div className="flex">
        <Sidebar userType={user.userType} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <main className="flex-1 lg:ml-64 p-3 sm:p-4 md:p-6 lg:p-8">
          <form className="max-w-5xl mx-auto space-y-4 sm:space-y-6" onSubmit={handleSubmit}>
            <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-visible sm:overflow-hidden">
              <div
                className="h-16 sm:h-20 w-full"
                style={{ backgroundColor: PROFILE_BANNER }}
                aria-hidden
              />
              <div className="h-[3px] w-full bg-[#DFC1CB]" aria-hidden />
              <div className="px-4 sm:px-8 pb-6 sm:pb-8">
                <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6 -mt-6 sm:-mt-11">
                  <div className="flex-shrink-0 flex flex-col items-center sm:items-start sm:translate-y-[2px]">
                    <div className={`relative ${hasPendingProfilePhoto ? 'rounded-full ring-2 ring-red-400 ring-offset-2 ring-offset-white' : ''}`}>
                      {profile?.profile_picture ? (
                        <img
                          src={toAbsoluteUrl(profile.profile_picture)}
                          alt=""
                          className="w-28 h-28 sm:w-36 sm:h-36 rounded-full object-cover border-4 border-white shadow-md ring-1 ring-black/5"
                        />
                      ) : (
                        <div
                          className="w-28 h-28 sm:w-36 sm:h-36 rounded-full border-4 border-white shadow-md ring-1 ring-black/5 flex items-center justify-center text-3xl sm:text-4xl font-semibold text-white"
                          style={{ backgroundColor: PROFILE_BANNER }}
                        >
                          {String(user?.name || user?.email || 'T').trim().charAt(0).toUpperCase() || 'T'}
                        </div>
                      )}
                      <label
                        htmlFor="teacher-profile-photo"
                        className="absolute bottom-1 right-1 sm:bottom-2 sm:right-2 inline-flex items-center justify-center w-8 h-8 rounded-full bg-white text-[#7B5A4A] border border-gray-200 shadow-sm hover:bg-gray-50 cursor-pointer"
                        aria-label="Edit profile photo"
                        title="Edit profile photo"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.768-6.768a2.5 2.5 0 113.536 3.536L12.536 16.536a4 4 0 01-1.789 1.02L7 18l.444-3.747A4 4 0 018.464 12.5z" />
                        </svg>
                      </label>
                    </div>
                    <input
                      id="teacher-profile-photo"
                      type="file"
                      name="profilePhoto"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="sr-only"
                    />
                    {formData.profilePhoto && (
                      <p className="mt-1 text-xs text-gray-500 truncate max-w-[12rem] sm:max-w-none" title={formData.profilePhoto.name}>
                        Selected: {formData.profilePhoto.name}
                      </p>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 text-center sm:text-left pb-0 sm:pb-2 mt-2 sm:mt-4">
                    <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 tracking-tight">
                      {user?.name || 'Teacher'}
                    </h1>
                    <p className="mt-1 text-sm text-gray-600 break-all sm:break-words">{user?.email}</p>
                    <p className="mt-2 inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                      Teacher
                    </p>
                  </div>
                </div>

                <div className="mt-8 sm:mt-10 border-t border-gray-200 pt-6 sm:pt-8">
                  <h2 className="text-lg font-semibold text-gray-900">About</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Introduce yourself to schools. This appears on your public-facing profile.
                  </p>
                  <div className="mt-4">
                    <textarea
                      rows={5}
                      value={formData.introText}
                      onChange={(e) => setFormData((prev) => ({ ...prev, introText: e.target.value }))}
                      maxLength={ABOUT_MAX_CHARACTERS}
                      className={`w-full px-3 py-2.5 text-sm rounded-lg bg-gray-50/80 focus:bg-white focus:outline-none transition-colors ${
                        hasAboutChanged
                          ? 'border-2 border-red-400 focus:ring-2 focus:ring-red-300'
                          : 'border border-gray-200 focus:ring-2 focus:ring-[#A7816D]/40 focus:border-[#A7816D]'
                      }`}
                      placeholder="Write your professional summary..."
                    />
                    <div className="mt-2 flex items-center justify-end">
                      <p className={`text-xs ${hasAboutChanged ? 'text-red-600' : 'text-gray-500'}`}>
                        {aboutText.length}/{ABOUT_MAX_CHARACTERS} characters
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
              <h2 className="text-lg font-semibold text-gray-900">Media & documents</h2>
              <p className="mt-1 text-sm text-gray-500">
                CV and introduction files schools may review.
              </p>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:gap-4">
                {Object.entries(FILE_META).map(([key, meta]) => {
                  const filePath = profile?.[key];
                  const fileUrl = toAbsoluteUrl(filePath);
                  const selectedUpload = formData[meta.formKey];
                  const hasPendingFileChange = Boolean(selectedUpload);
                  const inputId = `upload-${meta.formKey}`;
                  return (
                    <div
                      key={key}
                      className={`rounded-lg p-3 sm:p-4 bg-gray-50/70 ${
                        hasPendingFileChange ? 'border-2 border-red-400' : 'border border-gray-200'
                      }`}
                    >
                      <p className="text-sm font-medium text-gray-900">{meta.label}</p>
                      {filePath ? (
                        <>
                          <p className="mt-1 text-xs text-gray-600 truncate" title={getFileName(filePath)}>
                            {getFileName(filePath)}
                          </p>
                          <div className="mt-3">
                            {meta.type === 'image' && (
                              <img
                                src={fileUrl}
                                alt={meta.label}
                                className="w-full h-40 object-cover rounded-md border border-gray-200 bg-white"
                              />
                            )}
                            {meta.type === 'audio' && (
                              <audio controls className="w-full" src={fileUrl} />
                            )}
                            {meta.type === 'video' && (
                              <video controls className="w-full rounded-md border border-gray-200 bg-black/80 max-h-48" src={fileUrl} />
                            )}
                            {meta.type === 'document' && canPreviewDocumentInline(fileUrl) && (
                              <iframe
                                src={fileUrl}
                                title={meta.label}
                                className="w-full h-48 rounded-md border border-gray-200 bg-white"
                              />
                            )}
                            {meta.type === 'document' && !canPreviewDocumentInline(fileUrl) && (
                              <div className="text-xs text-gray-600 bg-white border border-gray-200 rounded-md px-3 py-2">
                                Preview not available for this file type.
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <p className="mt-1 text-xs text-gray-500">No file uploaded yet.</p>
                      )}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {filePath && (
                          <button
                            type="button"
                            onClick={() => {
                              if (meta.type === 'document') {
                                openPreviewModal({
                                  type: 'document',
                                  title: meta.label,
                                  url: fileUrl,
                                });
                                return;
                              }
                              window.open(fileUrl, '_blank', 'noopener,noreferrer');
                            }}
                            className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                          >
                            Open file
                          </button>
                        )}
                        <label
                          htmlFor={inputId}
                          className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                          Choose file
                        </label>
                        <input
                          id={inputId}
                          type="file"
                          name={meta.formKey}
                          accept={meta.accept}
                          onChange={handleFileChange}
                          className="hidden"
                        />
                        {selectedUpload && (
                          <p className="mt-1 text-xs text-red-600 truncate" title={selectedUpload.name}>
                            Selected: {selectedUpload.name}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {message && (
                <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                  <p className="text-sm text-gray-700">{message}</p>
                </div>
              )}

              <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <p className={`text-xs sm:mr-auto sm:self-center ${hasUnsavedChanges ? 'text-red-600' : 'text-gray-500'}`}>
                  {hasUnsavedChanges
                    ? 'You have unsaved changes highlighted in red.'
                    : 'Save applies your about text and any new files you selected.'}
                </p>
                <button
                  type="submit"
                  disabled={isSaving || !hasUnsavedChanges}
                  className={`inline-flex items-center justify-center rounded-lg px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors ${
                    isSaving || !hasUnsavedChanges
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'hover:opacity-95'
                  }`}
                  style={
                    isSaving || !hasUnsavedChanges ? undefined : { backgroundColor: PROFILE_BANNER }
                  }
                >
                  {isSaving ? 'Saving...' : 'Save profile'}
                </button>
              </div>
            </section>
          </form>
        </main>
      </div>
      {previewModal && createPortal(
        <div
          className="fixed bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewModal(null);
          }}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">{previewModal.title}</h2>
                <button
                  type="button"
                  onClick={() => setPreviewModal(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {previewModal.type === 'image' && (
                <img src={previewModal.url} alt={previewModal.title} className="w-full max-h-[65vh] object-contain rounded border" />
              )}
              {previewModal.type === 'audio' && <audio src={previewModal.url} controls className="w-full" />}
              {previewModal.type === 'video' && <video src={previewModal.url} controls className="w-full rounded border max-h-[65vh]" />}
              {previewModal.type === 'document' && (
                <div className="space-y-3">
                  <iframe src={previewModal.url} title={previewModal.title} className="w-full h-[65vh] rounded border" />
                  <a
                    href={previewModal.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                  >
                    Open in new tab
                  </a>
                </div>
              )}
              {previewModal.type === 'text' && (
                <div className="border border-gray-200 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">
                  {previewModal.text || '-'}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="fixed bottom-6 right-6 lg:hidden z-50 bg-primary-600 text-white p-4 rounded-full shadow-lg hover:bg-primary-700 transition-colors"
        aria-label="Toggle sidebar"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {isSidebarOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>
    </div>
  );
};

export default TeacherProfile;

