import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Modal, Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { getMyCompanyId, getMyRole, Role } from '../../features/audit/auditService';
import {
  listAllCustomQuestions, createCustomQuestion, updateCustomQuestion,
  deleteCustomQuestion, listAllLignes, createLigne, updateLigne,
  deleteLigne, seedDefaultLignes, importDefaultGemba, importDefault5S,
  CustomQuestion, CustomLigne,
} from '../../features/audit/contentService';

type Tab = 'gemba' | '5s' | 'lignes';

export default function ContentEditorScreen() {
  const [role, setRole] = useState<Role>('member');
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('gemba');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [gembaQs, setGembaQs] = useState<CustomQuestion[]>([]);
  const [fiveQs, setFiveQs] = useState<CustomQuestion[]>([]);
  const [lignes, setLignes] = useState<CustomLigne[]>([]);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<CustomQuestion | null>(null);
  const [formCode, setFormCode] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formCriteria, setFormCriteria] = useState('');
  const [isNew, setIsNew] = useState(false);

  const [ligneModal, setLigneModal] = useState(false);
  const [ligneEditing, setLigneEditing] = useState<CustomLigne | null>(null);
  const [ligneName, setLigneName] = useState('');

  const isAdmin = role === 'owner' || role === 'admin';

  const load = useCallback(async () => {
    try {
      const cid = await getMyCompanyId();
      console.log('[ui] companyId =', cid);
      setCompanyId(cid);
      if (!cid) return;
      const r = await getMyRole(cid);
      console.log('[ui] role =', r);
      setRole(r);
      if (r !== 'owner' && r !== 'admin') return;

      const [g, f, l] = await Promise.all([
        listAllCustomQuestions(cid, 'gemba'),
        listAllCustomQuestions(cid, '5s'),
        listAllLignes(cid),
      ]);
      console.log('[ui] loaded:', g.length, 'gemba,', f.length, '5s,', l.length, 'lignes');
      setGembaQs(g);
      setFiveQs(f);
      setLignes(l);
    } catch (e: any) {
      console.error('[ui] load error', e);
      Alert.alert('Erreur chargement', e.message ?? String(e));
    }
  }, []);

  useEffect(() => {
    (async () => {
      await load();
      setLoading(false);
    })();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        if (companyId) await load();
      })();
    }, [companyId, load])
  );

  /* ──────── Question editor ──────── */

  const openNewQuestion = () => {
    console.log('[ui] openNewQuestion tapped');
    setIsNew(true);
    setEditing(null);
    setFormCode('');
    setFormCategory('');
    setFormTitle('');
    setFormCriteria('');
    setEditorOpen(true);
  };

  const openEditQuestion = (q: CustomQuestion) => {
    console.log('[ui] openEditQuestion tapped:', q.id, q.code);
    setIsNew(false);
    setEditing(q);
    setFormCode(q.code);
    setFormCategory(q.category);
    setFormTitle(q.title);
    setFormCriteria(Array.isArray(q.criteria) ? q.criteria.join('\n') : '');
    setEditorOpen(true);
  };

  const saveQuestion = async () => {
    if (!companyId || tab === 'lignes') return;
    const criteria = formCriteria
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    setBusy(true);
    try {
      if (isNew) {
        console.log('[ui] creating question', formCode);
        await createCustomQuestion({
          companyId,
          auditType: tab,
          code: formCode,
          category: formCategory,
          title: formTitle,
          criteria,
        });
      } else if (editing) {
        console.log('[ui] updating question', editing.id);
        await updateCustomQuestion(editing.id, {
          code: formCode,
          category: formCategory,
          title: formTitle,
          criteria,
        });
      }
      setEditorOpen(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await load();
    } catch (e: any) {
      console.error('[ui] save question error', e);
      Alert.alert('Erreur', e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const removeQuestion = (q: CustomQuestion) => {
    console.log('[ui] removeQuestion tapped:', q.id, q.title);

    const doDelete = async () => {
      console.log('[ui] confirm delete:', q.id);
      setBusy(true);
      try {
        await deleteCustomQuestion(q.id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await load();
        Alert.alert('OK', 'Question supprimée.');
      } catch (e: any) {
        console.error('[ui] delete failed', e);
        Alert.alert('Erreur suppression', e.message ?? String(e));
      } finally {
        setBusy(false);
      }
    };

    if (Platform.OS === 'web') {
      // window.confirm works reliably on web
      const ok = typeof window !== 'undefined'
        ? window.confirm('Supprimer cette question ?\n\n' + q.title)
        : false;
      if (ok) doDelete();
    } else {
      Alert.alert('Supprimer cette question ?', q.title, [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  /* ──────── Import ──────── */

  const handleImportDefaults = async () => {
    if (!companyId || tab === 'lignes') return;
    console.log('[ui] import tapped, tab =', tab);

    const doImport = async () => {
      setBusy(true);
      try {
        const n = tab === 'gemba'
          ? await importDefaultGemba(companyId)
          : await importDefault5S(companyId);
        await load();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('OK', `${n} question(s) importée(s).`);
      } catch (e: any) {
        console.error('[ui] import error', e);
        Alert.alert('Erreur import', e.message ?? String(e));
      } finally {
        setBusy(false);
      }
    };

    if (Platform.OS === 'web') {
      const ok = typeof window !== 'undefined'
        ? window.confirm('Importer les questions par défaut ?')
        : false;
      if (ok) doImport();
    } else {
      Alert.alert('Importer ?', 'Les codes déjà présents seront ignorés.', [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Importer', onPress: doImport },
      ]);
    }
  };

  /* ──────── Lignes ──────── */

  const openNewLigne = () => {
    console.log('[ui] openNewLigne tapped');
    setLigneEditing(null);
    setLigneName('');
    setLigneModal(true);
  };

  const openEditLigne = (l: CustomLigne) => {
    console.log('[ui] openEditLigne tapped:', l.id);
    setLigneEditing(l);
    setLigneName(l.name);
    setLigneModal(true);
  };

  const saveLigne = async () => {
    if (!companyId) return;
    setBusy(true);
    try {
      if (ligneEditing) await updateLigne(ligneEditing.id, ligneName);
      else await createLigne(companyId, ligneName);
      setLigneModal(false);
      await load();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      console.error('[ui] save ligne error', e);
      Alert.alert('Erreur', e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const removeLigne = (l: CustomLigne) => {
    console.log('[ui] removeLigne tapped:', l.id, l.name);

    const doDelete = async () => {
      setBusy(true);
      try {
        await deleteLigne(l.id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await load();
      } catch (e: any) {
        console.error('[ui] delete ligne failed', e);
        Alert.alert('Erreur suppression', e.message ?? String(e));
      } finally {
        setBusy(false);
      }
    };

    if (Platform.OS === 'web') {
      const ok = typeof window !== 'undefined'
        ? window.confirm('Supprimer cette ligne ?\n\n' + l.name)
        : false;
      if (ok) doDelete();
    } else {
      Alert.alert('Supprimer cette ligne ?', l.name, [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const seedLignes = async () => {
    if (!companyId) return;
    setBusy(true);
    try {
      const n = await seedDefaultLignes(companyId);
      await load();
      Alert.alert('OK', `${n} ligne(s) ajoutée(s).`);
    } catch (e: any) {
      Alert.alert('Erreur', e.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#2563EB" size="large" />
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={styles.center}>
        <Text style={styles.lockIcon}>🔒</Text>
        <Text style={styles.lockTitle}>Accès réservé</Text>
      </View>
    );
  }

  const list = tab === 'gemba' ? gembaQs : fiveQs;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.pageTitle}>Configuration du contenu</Text>
        <Text style={styles.pageSub}>
          Importez, modifiez, ajoutez ou supprimez les questions et les lignes.
        </Text>

        <View style={styles.tabs}>
          {(['gemba', '5s', 'lignes'] as Tab[]).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.tab, tab === t && styles.tabActive]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === 'gemba' ? 'Questions Gemba' : t === '5s' ? 'Questions 5S' : 'Lignes'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab !== 'lignes' && (
          <>
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={openNewQuestion}
                disabled={busy}
              >
                <LinearGradient
                  colors={['#3B82F6', '#2563EB']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.actionGrad}
                >
                  <Text style={styles.actionText}>+ Nouvelle question</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.importBtn}
                onPress={handleImportDefaults}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color="#475569" />
                ) : (
                  <Text style={styles.importText}>Importer par défaut</Text>
                )}
              </TouchableOpacity>
            </View>

            {list.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyIcon}>📝</Text>
                <Text style={styles.emptyTitle}>Aucune question personnalisée</Text>
                <Text style={styles.emptyText}>
                  Cliquez sur « Importer par défaut » ou créez-en une.
                </Text>
              </View>
            ) : (
              list.map((q) => (
                <View key={q.id} style={styles.card}>
                  <View style={styles.cardHead}>
                    <Text style={styles.cardCode}>{q.code}</Text>
                    <Text style={styles.cardCat}>{q.category}</Text>
                  </View>
                  <Text style={styles.cardTitle}>{q.title}</Text>
                  {Array.isArray(q.criteria) && q.criteria.length > 0 && (
                    <View style={styles.criteriaBox}>
                      {q.criteria.map((c, ci) => (
                        <Text key={ci} style={styles.criteriaItem}>• {c}</Text>
                      ))}
                    </View>
                  )}
                  <View style={styles.rowBtns}>
                    <TouchableOpacity
                      style={styles.editBtn}
                      onPress={() => openEditQuestion(q)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.editText}>✎ Modifier</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.delBtn}
                      onPress={() => removeQuestion(q)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.delText}>🗑 Supprimer</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </>
        )}

        {tab === 'lignes' && (
          <>
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={openNewLigne}
                disabled={busy}
              >
                <LinearGradient
                  colors={['#3B82F6', '#2563EB']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.actionGrad}
                >
                  <Text style={styles.actionText}>+ Nouvelle ligne</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.importBtn}
                onPress={seedLignes}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color="#475569" />
                ) : (
                  <Text style={styles.importText}>Importer par défaut</Text>
                )}
              </TouchableOpacity>
            </View>

            {lignes.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyIcon}>📋</Text>
                <Text style={styles.emptyTitle}>Aucune ligne</Text>
              </View>
            ) : (
              lignes.map((l) => (
                <View key={l.id} style={styles.ligneCard}>
                  <Text style={styles.ligneName}>{l.name}</Text>
                  <View style={styles.rowBtns}>
                    <TouchableOpacity
                      style={styles.editBtn}
                      onPress={() => openEditLigne(l)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.editText}>✎</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.delBtn}
                      onPress={() => removeLigne(l)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.delText}>🗑</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* Question editor modal */}
      <Modal
        visible={editorOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setEditorOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {isNew ? 'Nouvelle question' : 'Modifier la question'}
            </Text>
            <ScrollView style={{ maxHeight: '80%' }}>
              <Text style={styles.label}>CODE</Text>
              <TextInput
                value={formCode}
                onChangeText={setFormCode}
                placeholder="S11 ou gemba-mo-1"
                placeholderTextColor="#94A3B8"
                style={styles.input}
              />

              <Text style={styles.label}>CATÉGORIE</Text>
              <TextInput
                value={formCategory}
                onChangeText={setFormCategory}
                placeholder="Ex : Eliminer"
                placeholderTextColor="#94A3B8"
                style={styles.input}
              />

              <Text style={styles.label}>TITRE</Text>
              <TextInput
                value={formTitle}
                onChangeText={setFormTitle}
                placeholder="Texte de la question"
                placeholderTextColor="#94A3B8"
                style={[styles.input, { height: 70 }]}
                multiline
              />

              <Text style={styles.label}>CRITÈRES (un par ligne)</Text>
              <TextInput
                value={formCriteria}
                onChangeText={setFormCriteria}
                placeholder={'Grille lisible\nGrille validée'}
                placeholderTextColor="#94A3B8"
                style={[styles.input, { height: 110, textAlignVertical: 'top' }]}
                multiline
              />

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: '#F1F5F9' }]}
                  onPress={() => setEditorOpen(false)}
                >
                  <Text style={{ color: '#475569', fontWeight: '800' }}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: '#2563EB' }]}
                  onPress={saveQuestion}
                  disabled={busy}
                >
                  {busy ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={{ color: '#FFF', fontWeight: '800' }}>Enregistrer</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Ligne editor modal */}
      <Modal
        visible={ligneModal}
        transparent
        animationType="fade"
        onRequestClose={() => setLigneModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {ligneEditing ? 'Modifier la ligne' : 'Nouvelle ligne'}
            </Text>
            <TextInput
              value={ligneName}
              onChangeText={setLigneName}
              placeholder="Nom de la ligne"
              placeholderTextColor="#94A3B8"
              style={styles.input}
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#F1F5F9' }]}
                onPress={() => setLigneModal(false)}
              >
                <Text style={{ color: '#475569', fontWeight: '800' }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#2563EB' }]}
                onPress={saveLigne}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={{ color: '#FFF', fontWeight: '800' }}>Enregistrer</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  scroll: { padding: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  lockIcon: { fontSize: 48, marginBottom: 12 },
  lockTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
  pageTitle: { fontSize: 26, fontWeight: '900', color: '#0F172A' },
  pageSub: { fontSize: 13, color: '#64748B', marginTop: 4, marginBottom: 20 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tab: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    backgroundColor: '#FFFFFF', alignItems: 'center',
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  tabActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  tabText: { fontSize: 12, fontWeight: '800', color: '#475569' },
  tabTextActive: { color: '#FFF' },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  actionBtn: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  actionGrad: { paddingVertical: 14, alignItems: 'center', borderRadius: 12 },
  actionText: { color: '#FFF', fontWeight: '800', letterSpacing: 1, fontSize: 13 },
  importBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    backgroundColor: '#F1F5F9', alignItems: 'center',
    borderWidth: 1, borderColor: '#CBD5E1',
  },
  importText: { color: '#475569', fontWeight: '800', fontSize: 12 },
  emptyBox: { alignItems: 'center', paddingVertical: 50 },
  emptyIcon: { fontSize: 42, marginBottom: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 6 },
  emptyText: { fontSize: 13, color: '#64748B', textAlign: 'center', paddingHorizontal: 24 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 10,
    shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  cardHead: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 6,
  },
  cardCode: { fontSize: 13, fontWeight: '900', color: '#2563EB', letterSpacing: 1 },
  cardCat: { fontSize: 11, color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase' },
  cardTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
  criteriaBox: {
    borderLeftWidth: 2, borderLeftColor: '#E2E8F0',
    paddingLeft: 10, marginBottom: 8,
  },
  criteriaItem: { fontSize: 12, color: '#475569', lineHeight: 18 },
  rowBtns: { flexDirection: 'row', gap: 10, marginTop: 10 },
  editBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center',
  },
  editText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12, letterSpacing: 0.5 },
  delBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    backgroundColor: '#DC2626', alignItems: 'center', justifyContent: 'center',
  },
  delText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12, letterSpacing: 0.5 },
  ligneCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 12,
    padding: 12, marginBottom: 8,
  },
  ligneName: { flex: 1, fontSize: 14, fontWeight: '800', color: '#0F172A' },
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(15,23,42,0.5)',
    justifyContent: 'center', padding: 20,
  },
  modalCard: { backgroundColor: '#FFF', borderRadius: 18, padding: 20, maxHeight: '90%' },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A', marginBottom: 16 },
  label: {
    fontSize: 11, fontWeight: '900', color: '#94A3B8',
    letterSpacing: 1.5, marginTop: 10, marginBottom: 4,
  },
  input: {
    borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#F8FAFC',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: '#0F172A',
  },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
});
