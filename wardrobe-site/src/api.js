import { supabase } from "./supabase";

const BUCKET = "wardrobe";

/* строка базы → объект вещи, каким его ждёт интерфейс */
const rowToItem = (r) => ({
  id: r.id,
  name: r.name || "",
  category: r.category,
  seasons: r.seasons || [],
  formality: r.formality ?? 2,
  colors: r.colors || ["#8a8078"],
  fav: !!r.fav,
  wear: r.wear ?? 0,
  lastWorn: r.last_worn,
  isWish: !!r.is_wish,
  set: r.set_key || undefined,
  path: r.img_path,
  img: supabase.storage.from(BUCKET).getPublicUrl(r.img_path).data.publicUrl,
});

const itemToRow = (i, userId) => ({
  id: i.id,
  user_id: userId,
  name: i.name || "",
  category: i.category,
  seasons: i.seasons || [],
  formality: i.formality ?? 2,
  colors: i.colors || [],
  fav: !!i.fav,
  wear: i.wear ?? 0,
  last_worn: i.lastWorn || null,
  is_wish: !!i.isWish,
  set_key: i.set || null,
  img_path: i.path,
});

export const api = {
  async loadAll(userId) {
    const [items, looks, settings] = await Promise.all([
      supabase.from("items").select("*").order("created_at", { ascending: true }),
      supabase.from("looks").select("*").order("created_at", { ascending: false }),
      supabase.from("settings").select("*").eq("user_id", userId).maybeSingle(),
    ]);
    if (items.error) throw items.error;
    return {
      items: (items.data || []).map(rowToItem),
      looks: (looks.data || []).map((l) => ({
        id: l.id, name: l.name || "", season: l.season, occasion: l.occasion,
        tpl: l.tpl, placed: l.placed || [], wornDates: l.worn_dates || [],
        createdAt: new Date(l.created_at).getTime(),
      })),
      settings: settings.data
        ? { city: settings.data.city || "", lat: settings.data.lat, lon: settings.data.lon, cityLabel: settings.data.city_label || "" }
        : { city: "", lat: null, lon: null, cityLabel: "" },
    };
  },

  /* фото уезжает в облачное хранилище, строка — в базу */
  async addItem(item, blob, userId) {
    const id = crypto.randomUUID();
    const path = `${userId}/${id}.webp`;
    const up = await supabase.storage.from(BUCKET).upload(path, blob, {
      contentType: "image/webp", upsert: true,
    });
    if (up.error) throw up.error;
    const row = itemToRow({ ...item, id, path }, userId);
    const { error } = await supabase.from("items").insert(row);
    if (error) throw error;
    return rowToItem(row);
  },

  async updateItem(id, patch, userId) {
    const row = {};
    const map = { name: "name", category: "category", seasons: "seasons", formality: "formality",
      colors: "colors", fav: "fav", wear: "wear", lastWorn: "last_worn", isWish: "is_wish" };
    Object.entries(patch).forEach(([k, v]) => { if (map[k]) row[map[k]] = v; });
    const { error } = await supabase.from("items").update(row).eq("id", id).eq("user_id", userId);
    if (error) throw error;
  },

  async deleteItem(item, userId) {
    if (item.path) await supabase.storage.from(BUCKET).remove([item.path]);
    const { error } = await supabase.from("items").delete().eq("id", item.id).eq("user_id", userId);
    if (error) throw error;
  },

  async saveLook(look, userId) {
    const row = {
      id: look.id?.startsWith("look_") ? crypto.randomUUID() : look.id,
      user_id: userId, name: look.name || "", season: look.season,
      occasion: look.occasion, tpl: look.tpl, placed: look.placed,
      worn_dates: look.wornDates || [],
    };
    const { error } = await supabase.from("looks").upsert(row);
    if (error) throw error;
    return { ...look, id: row.id };
  },

  async deleteLook(id, userId) {
    await supabase.from("looks").delete().eq("id", id).eq("user_id", userId);
  },

  async saveSettings(s, userId) {
    await supabase.from("settings").upsert({
      user_id: userId, city: s.city, lat: s.lat, lon: s.lon, city_label: s.cityLabel,
    });
  },

  async wipe(items, userId) {
    const paths = items.map((i) => i.path).filter(Boolean);
    if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
    await supabase.from("looks").delete().eq("user_id", userId);
    await supabase.from("items").delete().eq("user_id", userId);
  },
};
