import React, { createContext, useContext, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Pressable, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';
import { legalJson } from '../lib/legal';

// Yasal metni uygulamanın içinde gösterir. Neden: *.supabase.co, Edge Function'ın HTML yanıtını text/plain'e çeviriyor
// (platform kuralı); tarayıcıda ham kod görünür. legal?doc=…&format=json → body_md (Markdown) burada sade biçimde çizilir.
// Desteklenen: # başlık, > alıntı, - / 1. liste, | tablo (satır kartı), **kalın**, `kod`, [metin](adres).
// Metinler arası atıf [Başlık](/yasal/<anahtar>[?v=]) aynı okuyucuda açılır; geri oku önceki metne döner.
type Ref = { key: string; version?: string };
const OpenDoc = createContext<(r: Ref) => void>(() => {});

export function LegalTextView({ docKey, version, onClose }: { docKey: string; version?: string; onClose: () => void }) {
  const [stack, setStack] = useState<Ref[]>([{ key: docKey, version }]);
  const cur = stack[stack.length - 1];
  const [doc, setDoc] = useState<{ title: string; body: string; draft: boolean } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    setDoc(null); setFailed(false);
    legalJson(cur.key, cur.version)
      .then((d) => { if (live) setDoc({ title: d.title, body: d.body_md, draft: d.status !== 'published' }); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [cur.key, cur.version]);
  const open = (r: Ref) => { if (r.key !== cur.key || r.version !== cur.version) setStack((s) => [...s, r]); };
  const back = () => setStack((s) => s.slice(0, -1));

  return (
    <OpenDoc.Provider value={open}>
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={styles.head}>
        {stack.length > 1 && (
          <Pressable onPress={back} hitSlop={10} accessibilityRole="button" accessibilityLabel="Önceki metin" style={styles.close}>
            <Ionicons name="chevron-back" size={20} color={colors.navy} />
          </Pressable>
        )}
        <Text style={styles.headTitle} numberOfLines={1}>{doc?.title ?? 'Yasal metin'}</Text>
        <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Kapat" style={styles.close}>
          <Ionicons name="close" size={20} color={colors.navy} />
        </Pressable>
      </View>
      {failed ? (
        <Text style={[styles.p, { padding: 20 }]}>Metin açılamadı. İnternet bağlantını kontrol edip tekrar dene.</Text>
      ) : !doc ? (
        <ActivityIndicator color={colors.navy} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView key={`${cur.key}@${cur.version ?? ''}#${stack.length}`} contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 8 }}>
          {doc.draft && <View style={styles.draft}><Text style={styles.draftText}>TASLAK: avukat onayından önceki metin</Text></View>}
          <Markdown text={doc.body} title={doc.title} />
        </ScrollView>
      )}
    </View>
    </OpenDoc.Provider>
  );
}

// Satır içi: **kalın**, `kod`, [metin](adres). /yasal/<anahtar> okuyucuda açılır; http(s)/mailto dışarıda; diğeri düz metin.
const YASAL = /^\/yasal\/([a-z0-9-]+)(?:\?v=(v\d+))?$/;
function Inline({ text, style }: { text: string; style: object }) {
  const openDoc = useContext(OpenDoc);
  const parts = text.replace(/<\/?u>/g, '').split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g);
  return (
    <Text style={style}>
      {parts.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**')) return <Text key={i} style={{ fontWeight: '700' }}>{p.slice(2, -2)}</Text>;
        if (p.startsWith('`') && p.endsWith('`')) return <Text key={i}>{p.slice(1, -1)}</Text>;
        const m = p.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
        if (!m) return p;
        const label = m[1].replace(/\*\*/g, '');
        const y = m[2].match(YASAL);
        const press = y ? () => openDoc({ key: y[1], version: y[2] })
          : /^(https?:|mailto:)/.test(m[2]) ? () => { Linking.openURL(m[2]).catch(() => {}); } : null;
        return press ? <Text key={i} style={styles.link} onPress={press} accessibilityRole="link">{label}</Text> : label;
      })}
    </Text>
  );
}

function Markdown({ text, title }: { text: string; title?: string }) {
  const out: React.ReactNode[] = [];
  let para: string[] = [];
  let table: string[][] = [];
  let quote: string[] = [];
  const flush = () => {
    if (para.length) { out.push(<Inline key={out.length} text={para.join(' ')} style={styles.p} />); para = []; }
    if (table.length) { out.push(<Table key={out.length} rows={table} />); table = []; }
    if (quote.length) { out.push(<View key={out.length} style={styles.quote}><Markdown text={quote.join('\n')} /></View>); quote = []; }
  };
  text.split('\n').forEach((raw) => {
    const line = raw.trimEnd();
    if (!line.trim()) { flush(); return; }
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^>\s?(.*)$/))) { // alıntı bloğu: içi ayrıca çizilir (liste, kalın)
      if (para.length || table.length) flush();
      quote.push(m[1]);
      return;
    }
    if (line.startsWith('|')) {
      if (para.length || quote.length) flush();
      if (!/^\|[\s:|-]+\|$/.test(line) || !line.includes('-')) table.push(line.split('|').slice(1, -1).map((c) => c.trim()));
      return;
    }
    flush();
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) {
      if (m[1].length === 1 && out.length === 0 && m[2].trim() === title) return; // başlık zaten üstte
      out.push(<Inline key={out.length} text={m[2]} style={m[1].length === 1 ? styles.h1 : m[1].length === 2 ? styles.h2 : styles.h3} />);
    } else if ((m = line.match(/^\s*([-*]|\d+[.)])\s+(.*)$/))) {
      const bullet = /\d/.test(m[1]) ? m[1] : '•';
      out.push(
        <View key={out.length} style={{ flexDirection: 'row', gap: 8, paddingLeft: raw.startsWith('  ') ? 16 : 0 }}>
          <Text style={styles.p}>{bullet}</Text>
          <Inline text={m[2]} style={[styles.p, { flex: 1 }]} />
        </View>,
      );
    } else {
      para.push(line.trim());
      return;
    }
  });
  flush();
  return <>{out}</>;
}

// Tablo telefonda satır kartı olur: ilk hücre kalın başlık, diğerleri altında (3+ sütunda "Sütun: değer").
// Başlık satırı boşsa (| | |) yalnız satırlar.
function Table({ rows }: { rows: string[][] }) {
  const [head, ...body] = rows;
  const named = head.some(Boolean);
  const list = named ? body : rows;
  return (
    <View style={{ gap: 6 }}>
      {list.map((r, i) => (
        <View key={i} style={styles.row}>
          <Inline text={r[0] ?? ''} style={[styles.p, { fontWeight: '700', color: colors.navy }]} />
          {r.slice(1).map((c, j) => !!c && (
            <Inline key={j} text={named && head.length > 2 && head[j + 1] ? `**${head[j + 1]}:** ${c}` : c} style={styles.p} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  headTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.navy },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F2F6', alignItems: 'center', justifyContent: 'center' },
  draft: { backgroundColor: '#FFF4D6', borderRadius: radius.sm, padding: 10 },
  draftText: { fontSize: 12, fontWeight: '700', color: '#6B4D00' },
  h1: { fontSize: 20, fontWeight: '800', color: colors.navy, marginTop: 4 },
  h2: { fontSize: 17, fontWeight: '800', color: colors.navy, marginTop: 12 },
  h3: { fontSize: 15, fontWeight: '700', color: colors.navy, marginTop: 8 },
  p: { fontSize: 14, lineHeight: 21, color: '#2E3446' },
  quote: { borderLeftWidth: 3, borderLeftColor: colors.line, paddingLeft: 12, gap: 8 },
  link: { color: colors.navy, fontWeight: '700', textDecorationLine: 'underline' },
  row: { backgroundColor: '#F6F7FB', borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10, gap: 2 },
});
