import { Linking } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '@/lib/supabase';

export const SOURCE_DOCUMENT_BUCKET = 'mri-source-documents';
export const SIGNED_URL_SECONDS = 600;

export type PickedPdf = {
  uri: string;
  name: string;
  size: number | null;
  mimeType: string;
};

export async function pickPdf(): Promise<PickedPdf | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/pdf',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  const mimeType = (asset.mimeType || 'application/pdf').toLowerCase();
  const name = asset.name || 'source-document.pdf';
  if (mimeType !== 'application/pdf' && !name.toLowerCase().endsWith('.pdf')) {
    throw new Error('Only PDF documents can be uploaded.');
  }
  return { uri: asset.uri, name, size: asset.size ?? null, mimeType: 'application/pdf' };
}

function safeFileName(name: string) {
  const base = name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}

export async function uploadPdfForDevice(deviceId: string, pdf: PickedPdf) {
  const response = await fetch(pdf.uri);
  if (!response.ok) throw new Error(`Could not read selected PDF (${response.status}).`);
  const body = await response.arrayBuffer();
  const path = `${deviceId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${safeFileName(pdf.name)}`;

  const { error } = await supabase.storage.from(SOURCE_DOCUMENT_BUCKET).upload(path, body, {
    contentType: 'application/pdf',
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
  return { path, size: pdf.size ?? body.byteLength };
}

export async function removeUploadedPdf(path: string) {
  if (!path) return;
  await supabase.storage.from(SOURCE_DOCUMENT_BUCKET).remove([path]);
}

export async function createSourceSignedUrl(path: string, expiresIn = SIGNED_URL_SECONDS) {
  const { data, error } = await supabase.storage.from(SOURCE_DOCUMENT_BUCKET).createSignedUrl(path, expiresIn);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error('Could not create a signed document URL.');
  return data.signedUrl;
}

export async function openSourcePdf(path: string) {
  const signedUrl = await createSourceSignedUrl(path);
  await Linking.openURL(signedUrl);
  return signedUrl;
}
