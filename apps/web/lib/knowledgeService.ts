import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  onSnapshot 
} from 'firebase/firestore';
import { db } from './firebase';

export interface KnowledgeFolder {
  id: string;
  name: string;
  order: number;
  parentId?: string | null;
}

export interface KnowledgeArticle {
  id: string;
  folderId: string | null;
  title: string;
  content: string;
  isSop: boolean;
  isTemplate?: boolean;
  isPublished: boolean;
  createdAt: number;
  updatedAt: number;
  order: number;
  
  // Advanced Sharing & RBAC
  ownerId?: string; // User ID of the creator
  visibility?: 'private' | 'tenant' | 'shared'; // 'tenant' means all internal users see it
  permissions?: { [userId: string]: 'viewer' | 'editor' };
}

export const subscribeToKnowledgeFolders = (
  tenantId: string, 
  callback: (folders: KnowledgeFolder[]) => void
) => {
  const q = query(
    collection(db, 'tenants', tenantId, 'knowledgeFolders'), 
    orderBy('order', 'asc')
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as KnowledgeFolder)));
  });
};

export const subscribeToKnowledgeArticles = (
  tenantId: string, 
  callback: (articles: KnowledgeArticle[]) => void
) => {
  const q = query(
    collection(db, 'tenants', tenantId, 'knowledgeArticles'), 
    orderBy('order', 'asc')
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as KnowledgeArticle)));
  });
};

export const saveKnowledgeFolder = async (tenantId: string, folder: KnowledgeFolder) => {
  const folderRef = doc(db, 'tenants', tenantId, 'knowledgeFolders', folder.id);
  await setDoc(folderRef, folder, { merge: true });
};

export const deleteKnowledgeFolder = async (tenantId: string, folderId: string) => {
  await deleteDoc(doc(db, 'tenants', tenantId, 'knowledgeFolders', folderId));
};

export const saveKnowledgeArticle = async (tenantId: string, article: KnowledgeArticle) => {
  const articleRef = doc(db, 'tenants', tenantId, 'knowledgeArticles', article.id);
  await setDoc(articleRef, { ...article, updatedAt: Date.now() }, { merge: true });
};

export const deleteKnowledgeArticle = async (tenantId: string, articleId: string) => {
  await deleteDoc(doc(db, 'tenants', tenantId, 'knowledgeArticles', articleId));
};

export interface KnowledgeArticleVersion {
  id: string;
  articleId: string;
  title: string;
  content: string;
  savedAt: number;
  savedByUserId?: string;
  savedByUserName?: string;
}

export const saveArticleVersion = async (tenantId: string, articleId: string, title: string, content: string, userId?: string, userName?: string) => {
  const versionId = Date.now().toString(); // Use timestamp as version doc ID for easy ordering
  const versionRef = doc(db, 'tenants', tenantId, 'knowledgeArticles', articleId, 'versions', versionId);
  const snapshot: KnowledgeArticleVersion = {
    id: versionId,
    articleId,
    title,
    content,
    savedAt: Date.now(),
    savedByUserId: userId || 'system',
    savedByUserName: userName || 'System',
  };
  await setDoc(versionRef, snapshot);
};

export const getArticleVersions = async (tenantId: string, articleId: string): Promise<KnowledgeArticleVersion[]> => {
  const q = query(
    collection(db, 'tenants', tenantId, 'knowledgeArticles', articleId, 'versions'),
    orderBy('savedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as KnowledgeArticleVersion));
};
