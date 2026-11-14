import type { Metadata } from "next";
import { CalendarDays, ChevronRight, Clock3, Images, Mail, MapPin, Phone, ScrollText, Users } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ContactForm } from "@/components/contact-form";
import { TenantHeader } from "@/components/tenant-header";
import { TreeExplorer } from "@/components/tree-explorer";
import { TreeUnlockForm } from "@/components/tree-unlock-form";
import { getTenantSnapshot } from "@/lib/repository/tenants";

type RouteProps = { params: Promise<{ slug: string; page?: string[] }> };

function routeTitle(page: string) {
  if (page.startsWith("/tin-tuc/")) return "Chi tiết bài viết";
  if (page.startsWith("/thu-vien/")) return "Chi tiết album";
  return ({
    "/": "Trang chủ",
    "/pha-do": "Phả đồ dòng họ",
    "/tin-tuc": "Tin tức dòng họ",
    "/su-kien": "Sự kiện dòng họ",
    "/thu-vien": "Thư viện dòng họ",
    "/pha-ky": "Phả ký dòng họ",
    "/lien-he": "Kết nối Ban tộc biểu"
  } as Record<string, string>)[page] ?? "Trang không tồn tại";
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { slug, page } = await params;
  const snapshot = await getTenantSnapshot(slug);
  if (!snapshot) return { title: "Không tìm thấy dòng họ" };
  const path = page?.length ? `/${page.join("/")}` : "/";
  const post = page?.[0] === "tin-tuc" && page[1] ? snapshot.posts.find((item) => item.slug === page[1]) : undefined;
  const album = page?.[0] === "thu-vien" && page[1] ? snapshot.albums.find((item) => item.id === page[1]) : undefined;
  const pageTitle = post?.title ?? album?.title ?? routeTitle(path);
  return {
    title: path === "/" ? (snapshot.tenant.seo?.title ?? `${pageTitle} — ${snapshot.tenant.shortName}`) : `${pageTitle} — ${snapshot.tenant.shortName}`,
    description: post?.excerpt ?? album?.description ?? snapshot.tenant.seo?.description ?? snapshot.tenant.introduction,
    openGraph: {
      title: `${pageTitle} — ${snapshot.tenant.shortName}`,
      description: post?.excerpt ?? album?.description ?? snapshot.tenant.seo?.description ?? snapshot.tenant.introduction,
      type: "website",
      locale: "vi_VN",
      images: post?.coverUrl ? [post.coverUrl] : album?.coverUrl ? [album.coverUrl] : snapshot.tenant.theme.bannerUrl ? [snapshot.tenant.theme.bannerUrl] : undefined
    },
    robots: !snapshot.tenant.published || (path === "/pha-do" && snapshot.tree.visibility === "protected")
      ? { index: false, follow: false }
      : undefined
  };
}

export default async function TenantSitePage({ params }: RouteProps) {
  const { slug, page } = await params;
  const snapshot = await getTenantSnapshot(slug);
  if (!snapshot) notFound();
  const currentPath = page?.length ? `/${page.join("/")}` : "/";
  const sectionPath = page?.length ? `/${page[0]}` : "/";
  const validSections = new Set(["/", "/pha-do", "/tin-tuc", "/su-kien", "/thu-vien", "/pha-ky", "/lien-he"]);
  const validDetail = page?.length === 2 && ["tin-tuc", "thu-vien"].includes(page[0]);
  if (!validSections.has(sectionPath) || (page && page.length > 1 && !validDetail)) notFound();
  const requestHeaders = await headers();
  const isSubdomain = requestHeaders.get("x-tenant-slug") === slug;
  const basePath = isSubdomain ? "" : `/site/${slug}`;
  const { tenant, tree, posts, events, albums } = snapshot;
  const selectedPost = page?.[0] === "tin-tuc" && page[1] ? posts.find((post) => post.slug === page[1]) : undefined;
  const selectedAlbum = page?.[0] === "thu-vien" && page[1] ? albums.find((album) => album.id === page[1]) : undefined;
  if (validDetail && !selectedPost && !selectedAlbum) notFound();
  const maxGeneration = tree.persons.length ? Math.max(...tree.persons.map((person) => person.generation)) : 0;
  const visiblePaths = ["/", "/pha-do", ...(posts.length ? ["/tin-tuc"] : []), ...(events.length ? ["/su-kien"] : []), ...(albums.length ? ["/thu-vien"] : []), ...(tenant.chronicle ? ["/pha-ky"] : []), "/lien-he"];

  return (
    <div
      className="tenant-site"
      style={{ "--tenant-primary": tenant.theme.primaryColor, "--tenant-accent": tenant.theme.accentColor } as React.CSSProperties}
    >
      <TenantHeader name={tenant.shortName} logoUrl={tenant.theme.logoUrl} basePath={basePath} activePath={sectionPath} visiblePaths={visiblePaths} />
      {currentPath === "/" && (
        <main>
          <section className="tenant-hero" style={tenant.theme.bannerUrl ? { backgroundImage: `linear-gradient(105deg, rgba(84, 30, 18, .91), rgba(169, 60, 32, .82)), url(${tenant.theme.bannerUrl})` } : undefined}>
            <div className="tenant-hero-pattern" aria-hidden="true" />
            <div className="tenant-container tenant-hero-content">
              <span>Uống nước nhớ nguồn · Tổ tiên hiển hách</span>
              <h1>{tenant.name}</h1>
              <p>{tenant.introduction}</p>
              <div>
                <Link className="tenant-button light" href={`${basePath}/pha-do`}>Xem phả đồ dòng họ <ChevronRight /></Link>
                <Link className="tenant-button outline" href={`${basePath}/tin-tuc`}>Tin tức & sự kiện</Link>
              </div>
            </div>
          </section>
          <section className="tenant-stat-wrap">
            <div className="tenant-container tenant-stats">
              <div><strong>{maxGeneration || "—"}</strong><span>Đời con cháu</span></div>
              <div><strong>{tree.persons.length}</strong><span>Thành viên</span></div>
              <div><strong>{posts.length}</strong><span>Bài viết</span></div>
              <div><strong>{albums.reduce((sum, album) => sum + album.imageCount, 0)}</strong><span>Hình ảnh</span></div>
            </div>
          </section>
          <section className="tenant-section tenant-intro">
            <div className="tenant-container tenant-intro-grid">
              <div className="tenant-chronicle-mark" aria-hidden="true"><span>家</span><small>Gia phong lưu truyền</small></div>
              <div>
                <span className="tenant-eyebrow">Lời ngỏ từ Ban tộc biểu</span>
                <h2>Gốc rễ bền sâu, cành lá sum vầy</h2>
                <p>{tenant.chronicle}</p>
                <Link className="tenant-text-link" href={`${basePath}/pha-ky`}>Đọc phả ký dòng họ <ChevronRight /></Link>
              </div>
            </div>
          </section>
          <section className="tenant-section tenant-content-section">
            <div className="tenant-container">
              <div className="tenant-section-heading">
                <div><span className="tenant-eyebrow">Chuyện trong họ</span><h2>Tin mới & ký ức mới</h2></div>
                <Link href={`${basePath}/tin-tuc`}>Xem tất cả <ChevronRight /></Link>
              </div>
              <div className="tenant-card-grid">
                {posts.map((post, index) => (
                  <Link className="tenant-article-card" href={`${basePath}/tin-tuc/${post.slug}`} key={post.id}>
                    <div className={`tenant-card-art art-${index + 1}`}><ScrollText /></div>
                    <span>{post.category}</span>
                    <h3>{post.title}</h3>
                    <p>{post.excerpt}</p>
                    <small>{post.publishedAt ? new Intl.DateTimeFormat("vi-VN").format(new Date(post.publishedAt)) : ""}</small>
                  </Link>
                ))}
              </div>
            </div>
          </section>
          <section className="tenant-section tenant-event-preview">
            <div className="tenant-container">
              <span className="tenant-eyebrow">Ngày chung của dòng họ</span>
              {events[0] ? <div className="tenant-next-event">
                <div><small>Sự kiện sắp tới</small><h2>{events[0]?.title}</h2><p><MapPin /> {events[0]?.location} · {events[0]?.lunarLabel}</p></div>
                <div className="event-date"><strong>{new Intl.DateTimeFormat("vi-VN", { day: "2-digit" }).format(new Date(events[0].startsAt))}</strong><span>Tháng {new Intl.DateTimeFormat("vi-VN", { month: "2-digit" }).format(new Date(events[0].startsAt))}</span></div>
              </div> : <p>Chưa có sự kiện sắp tới.</p>}
            </div>
          </section>
        </main>
      )}

      {currentPath !== "/" && (
        <main>
          <section className="tenant-subhero">
            <div className="tenant-container">
              <span>Trang chủ / {routeTitle(currentPath)}</span>
              <h1>{selectedPost?.title ?? selectedAlbum?.title ?? routeTitle(currentPath)}</h1>
              <p>{
                selectedPost ? selectedPost.excerpt :
                selectedAlbum ? selectedAlbum.description :
                currentPath === "/pha-do" ? "Một sơ đồ trực quan để con cháu tra cứu các thế hệ và tìm về nhánh gia đình của mình." :
                currentPath === "/tin-tuc" ? "Những câu chuyện, hoạt động và ghi chép mới từ con cháu trong dòng họ." :
                currentPath === "/su-kien" ? "Các ngày họp mặt, tưởng niệm và hoạt động chung để mọi người cùng sắp xếp tham dự." :
                currentPath === "/thu-vien" ? "Hình ảnh và tư liệu được gìn giữ, chú thích qua từng năm." :
                currentPath === "/pha-ky" ? "Câu chuyện hình thành, gia phong và những dấu mốc của dòng họ." :
                "Gửi thông tin, tư liệu hoặc lời nhắn đến Ban tộc biểu."
              }</p>
            </div>
          </section>
          {currentPath === "/pha-do" && <section className="tenant-tree-section"><div className="tenant-container wide">{tree.visibility === "protected" && !snapshot.treeAccessGranted ? <TreeUnlockForm treeId={tree.id} /> : <TreeExplorer initialTree={tree} />}</div></section>}
          {currentPath === "/tin-tuc" && (
            <section className="tenant-section"><div className="tenant-container tenant-list-grid">{posts.map((post) => <Link className="tenant-list-card" href={`${basePath}/tin-tuc/${post.slug}`} key={post.id}><span>{post.category}</span><h2>{post.title}</h2><p>{post.excerpt}</p><small>{post.publishedAt ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "long" }).format(new Date(post.publishedAt)) : ""}</small></Link>)}</div></section>
          )}
          {selectedPost && <section className="tenant-section"><article className="tenant-container tenant-detail"><span className="tenant-eyebrow">{selectedPost.category}</span>{selectedPost.publishedAt && <small>{new Intl.DateTimeFormat("vi-VN", { dateStyle: "long" }).format(new Date(selectedPost.publishedAt))}</small>}{selectedPost.bodyHtml ? <div className="tenant-rich-content" dangerouslySetInnerHTML={{ __html: selectedPost.bodyHtml }} /> : <div><p>{selectedPost.bodyText || selectedPost.excerpt}</p></div>}<Link className="tenant-text-link" href={`${basePath}/tin-tuc`}>← Trở lại tin tức</Link></article></section>}
          {currentPath === "/su-kien" && (
            <section className="tenant-section"><div className="tenant-container tenant-events-list">{events.map((event) => <article key={event.id}><div className="event-calendar"><CalendarDays /><strong>{new Intl.DateTimeFormat("vi-VN", { day: "2-digit" }).format(new Date(event.startsAt))}</strong><span>Tháng {new Intl.DateTimeFormat("vi-VN", { month: "2-digit" }).format(new Date(event.startsAt))}</span></div><div><span className="tenant-eyebrow">{event.lunarLabel}</span><h2>{event.title}</h2><p>{event.description}</p><small><Clock3 /> {new Intl.DateTimeFormat("vi-VN", { dateStyle: "full", timeStyle: "short" }).format(new Date(event.startsAt))} · <MapPin /> {event.location}</small></div></article>)}</div></section>
          )}
          {currentPath === "/thu-vien" && (
            <section className="tenant-section"><div className="tenant-container tenant-album-grid">{albums.map((album, index) => <Link href={`${basePath}/thu-vien/${album.id}`} key={album.id}><div className={`album-art album-${index + 1}`}><Images /><span>{album.imageCount} ảnh</span></div><h2>{album.title}</h2><p>{album.description}</p></Link>)}</div></section>
          )}
          {selectedAlbum && <section className="tenant-section"><div className="tenant-container tenant-detail"><p>{selectedAlbum.description}</p>{selectedAlbum.images?.length ? <div className="tenant-photo-grid">{selectedAlbum.images.map((photo) => <figure key={photo.id}><Image src={photo.url} alt={photo.alt} width={960} height={720} sizes="(max-width: 760px) 100vw, 420px" unoptimized /></figure>)}</div> : <p>Album chưa có ảnh công khai.</p>}{selectedAlbum.youtubeUrl && <p><a className="tenant-text-link" href={selectedAlbum.youtubeUrl} target="_blank" rel="noreferrer">Xem video YouTube <ChevronRight /></a></p>}<Link className="tenant-text-link" href={`${basePath}/thu-vien`}>← Trở lại thư viện</Link></div></section>}
          {currentPath === "/pha-ky" && (
            <section className="tenant-section"><div className="tenant-container chronicle-layout"><aside><span>1882</span><i /><span>1954</span><i /><span>2026</span></aside><article><span className="tenant-eyebrow">Phả ký lưu truyền</span><h2>Từ một mái nhà đến những nhánh con cháu hôm nay</h2><p>{tenant.chronicle}</p><p>Những tư liệu trong phả ký được Ban tộc biểu kiểm chứng từ lời kể của các bậc cao niên, gia phả giấy và tài liệu do từng gia đình đóng góp. Các chi tiết chưa chắc chắn được đánh dấu để tiếp tục bổ sung.</p><blockquote>“Gìn giữ không chỉ là nhớ tên tổ tiên, mà còn là tiếp nối cách người xưa sống tử tế với gia đình và quê hương.”</blockquote></article></div></section>
          )}
          {currentPath === "/lien-he" && (
            <section className="tenant-section"><div className="tenant-container contact-layout"><aside><span className="tenant-eyebrow">Thông tin liên hệ</span><h2>Ban tộc biểu</h2><p><MapPin /> {tenant.address}</p><p><Mail /> {tenant.contactEmail}</p><p><Phone /> {tenant.contactPhone}</p>{tenant.mapUrl && <p><a className="tenant-text-link" href={tenant.mapUrl} target="_blank" rel="noreferrer">Mở bản đồ <ChevronRight /></a></p>}<div className="contact-note"><Users /><span>Bạn có tư liệu hoặc thông tin thành viên cần bổ sung? Hãy ghi rõ nhánh gia đình trong lời nhắn.</span></div></aside><ContactForm tenantId={tenant.id} /></div></section>
          )}
        </main>
      )}
      <footer className="tenant-footer"><div className="tenant-container"><div><strong>{tenant.shortName}</strong><p>{tenant.introduction}</p></div><div><span>Địa chỉ</span><p>{tenant.address}</p></div><div><span>Liên hệ</span><p>{tenant.contactPhone}<br />{tenant.contactEmail}</p></div></div><small>Không gian được tạo bằng GiaPhaVN · Dữ liệu thuộc về dòng họ</small></footer>
    </div>
  );
}
