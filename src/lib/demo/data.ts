import { normalizeVietnameseName } from "@/lib/domain/genealogy";
import type {
  Album,
  ClanEvent,
  FamilyTree,
  ParentageLink,
  Person,
  Post,
  Tenant,
  TenantSnapshot
} from "@/lib/domain/types";

const tenantId = "tenant-demo-hong-viet";
const treeId = "tree-demo-main";
const publicFields = {
  avatar: true,
  exactBirthDate: false,
  phone: false,
  email: false,
  address: false,
  biography: false
};

function person(
  id: string,
  fullName: string,
  gender: Person["gender"],
  generation: number,
  sortOrder: number,
  options: Partial<Person> = {}
): Person {
  return {
    id,
    tenantId,
    treeId,
    fullName,
    searchName: normalizeVietnameseName(fullName),
    gender,
    generation,
    isDeceased: false,
    publicFields,
    sortOrder,
    ...options
  };
}

const persons: Person[] = [
  person("p1", "Nguyễn Văn Khải", "male", 1, 1, {
    roleTitle: "Thủy tổ",
    birthDate: { value: "1882", precision: "year", calendar: "solar" },
    deathDate: { value: "1954", precision: "year", calendar: "solar" },
    isDeceased: true,
    biography: "Người đặt nền móng cho chi họ Nguyễn tại vùng đất ven sông Hàn.",
    publicFields: { ...publicFields, biography: true }
  }),
  person("p2", "Lê Thị Hoa", "female", 1, 2, {
    birthDate: { value: "1888", precision: "year", calendar: "solar" },
    deathDate: { value: "1962", precision: "year", calendar: "solar" },
    isDeceased: true
  }),
  person("p3", "Nguyễn Văn Minh", "male", 2, 1, {
    roleTitle: "Trưởng chi",
    birthDate: { value: "1910", precision: "year", calendar: "solar" },
    deathDate: { value: "1989", precision: "year", calendar: "solar" },
    isDeceased: true
  }),
  person("p4", "Nguyễn Văn An", "male", 2, 2, {
    birthDate: { value: "1914", precision: "year", calendar: "solar" },
    deathDate: { value: "1992", precision: "year", calendar: "solar" },
    isDeceased: true
  }),
  person("p5", "Nguyễn Thị Lan", "female", 2, 3, {
    birthDate: { value: "1920", precision: "year", calendar: "solar" },
    deathDate: { value: "2001", precision: "year", calendar: "solar" },
    isDeceased: true
  }),
  person("p6", "Trần Thị Thu", "female", 2, 4, {
    birthDate: { value: "1916", precision: "year", calendar: "solar" },
    deathDate: { value: "2003", precision: "year", calendar: "solar" },
    isDeceased: true
  }),
  person("p7", "Nguyễn Văn Thành", "male", 3, 1, {
    birthDate: { value: "1941", precision: "year", calendar: "solar" }
  }),
  person("p8", "Nguyễn Thị Mai", "female", 3, 2, {
    birthDate: { value: "1946", precision: "year", calendar: "solar" }
  }),
  person("p9", "Phạm Thị Hạnh", "female", 2, 5, {
    birthDate: { value: "1922", precision: "year", calendar: "solar" },
    deathDate: { value: "2007", precision: "year", calendar: "solar" },
    isDeceased: true
  }),
  person("p10", "Nguyễn Văn Dũng", "male", 3, 3, {
    birthDate: { value: "1950", precision: "year", calendar: "solar" }
  }),
  person("p11", "Võ Văn Bình", "male", 2, 6, {
    birthDate: { value: "1918", precision: "year", calendar: "solar" },
    deathDate: { value: "1998", precision: "year", calendar: "solar" },
    isDeceased: true
  }),
  person("p12", "Võ Thị Ngọc", "female", 3, 4, {
    birthDate: { value: "1952", precision: "year", calendar: "solar" }
  }),
  person("p13", "Võ Văn Nam", "male", 3, 5, {
    birthDate: { value: "1956", precision: "year", calendar: "solar" }
  }),
  person("p14", "Đặng Thị Yến", "female", 3, 6, {
    birthDate: { value: "1945", precision: "year", calendar: "solar" }
  }),
  person("p15", "Nguyễn Hoàng Gia", "male", 4, 1, {
    birthDate: { value: "1973", precision: "year", calendar: "solar" },
    roleTitle: "Ban tộc biểu"
  }),
  person("p16", "Nguyễn Thu Hà", "female", 4, 2, {
    birthDate: { value: "1978", precision: "year", calendar: "solar" }
  })
];

const parentage = (
  id: string,
  parentId: string,
  childId: string,
  unionId: string,
  sortOrder: number
): ParentageLink => ({
  id,
  tenantId,
  treeId,
  parentId,
  childId,
  unionId,
  relationshipType: "biological",
  sortOrder
});

export const demoTree: FamilyTree = {
  id: treeId,
  tenantId,
  name: "Phả đồ họ Nguyễn — Chi Đà Nẵng",
  rootPersonId: "p1",
  visibility: "public",
  graphVersion: 12,
  persons,
  unions: [
    { id: "u1", tenantId, treeId, partnerIds: ["p1", "p2"], sortOrder: 1 },
    { id: "u2", tenantId, treeId, partnerIds: ["p3", "p6"], sortOrder: 1 },
    { id: "u3", tenantId, treeId, partnerIds: ["p4", "p9"], sortOrder: 2 },
    { id: "u4", tenantId, treeId, partnerIds: ["p5", "p11"], sortOrder: 3 },
    { id: "u5", tenantId, treeId, partnerIds: ["p7", "p14"], sortOrder: 1 }
  ],
  parentageLinks: [
    ...["p3", "p4", "p5"].flatMap((childId, childIndex) =>
      ["p1", "p2"].map((parentId, parentIndex) =>
        parentage(`l1-${childIndex}-${parentIndex}`, parentId, childId, "u1", childIndex + 1)
      )
    ),
    ...["p7", "p8"].flatMap((childId, childIndex) =>
      ["p3", "p6"].map((parentId, parentIndex) =>
        parentage(`l2-${childIndex}-${parentIndex}`, parentId, childId, "u2", childIndex + 1)
      )
    ),
    ...["p4", "p9"].map((parentId, parentIndex) =>
      parentage(`l3-${parentIndex}`, parentId, "p10", "u3", 1)
    ),
    ...["p5", "p11"].flatMap((parentId, parentIndex) =>
      ["p12", "p13"].map((childId, childIndex) =>
        parentage(`l4-${childIndex}-${parentIndex}`, parentId, childId, "u4", childIndex + 1)
      )
    ),
    ...["p7", "p14"].flatMap((parentId, parentIndex) =>
      ["p15", "p16"].map((childId, childIndex) =>
        parentage(`l5-${childIndex}-${parentIndex}`, parentId, childId, "u5", childIndex + 1)
      )
    )
  ]
};

export const demoTenant: Tenant = {
  id: tenantId,
  slug: "demo-hong-viet",
  name: "Gia phả họ Nguyễn — Đà Nẵng",
  shortName: "Họ Nguyễn — Đà Nẵng",
  introduction:
    "Nơi gìn giữ gốc tích, ký ức và những giá trị tốt đẹp của con cháu họ Nguyễn qua nhiều thế hệ.",
  chronicle:
    "Từ cuối thế kỷ XIX, cụ Nguyễn Văn Khải cùng gia quyến dựng nghiệp bên dòng sông Hàn. Con cháu luôn lấy hiếu học, nghĩa tình và phụng sự quê hương làm nền nếp.",
  address: "Quận Hải Châu, thành phố Đà Nẵng",
  contactEmail: "bantocbieu@example.vn",
  contactPhone: "0900 000 000",
  published: true,
  theme: { primaryColor: "#a83f24", accentColor: "#d59b2d" }
};

const posts: Post[] = [
  {
    id: "post-1",
    tenantId,
    slug: "ngay-hoi-doan-vien-2026",
    title: "Ngày hội đoàn viên — cùng kể chuyện nguồn cội",
    excerpt: "Con cháu bốn phương trở về, cùng nghe các bậc cao niên kể lại ký ức của dòng họ.",
    category: "Tin dòng họ",
    status: "published",
    publishedAt: "2026-10-20T08:00:00.000Z"
  },
  {
    id: "post-2",
    tenantId,
    slug: "ghi-chep-pha-ky",
    title: "Cách chúng tôi cùng nhau hoàn thiện phả ký",
    excerpt: "Một quy trình nhỏ để mỗi gia đình đóng góp tư liệu mà vẫn giữ được sự thống nhất.",
    category: "Phả ký",
    status: "published",
    publishedAt: "2026-09-12T08:00:00.000Z"
  },
  {
    id: "post-3",
    tenantId,
    slug: "quy-khuyen-hoc",
    title: "Quỹ khuyến học tiếp sức thế hệ trẻ",
    excerpt: "Ghi nhận những nỗ lực học tập và lan tỏa truyền thống hiếu học trong dòng họ.",
    category: "Công đức",
    status: "published",
    publishedAt: "2026-08-28T08:00:00.000Z"
  }
];

const events: ClanEvent[] = [
  {
    id: "event-1",
    tenantId,
    title: "Họp mặt đại gia đình",
    description: "Tổng kết hoạt động năm và cập nhật thông tin phả hệ.",
    startsAt: "2026-11-30T01:00:00.000Z",
    lunarLabel: "22/10 Bính Ngọ",
    location: "Nhà thờ tộc",
    status: "published"
  },
  {
    id: "event-2",
    tenantId,
    title: "Lễ tưởng niệm thủy tổ",
    description: "Con cháu dâng hương và ôn lại gia phong.",
    startsAt: "2027-02-21T00:30:00.000Z",
    lunarLabel: "16/01 Đinh Mùi",
    location: "Từ đường họ Nguyễn",
    status: "published"
  }
];

const albums: Album[] = [
  {
    id: "album-1",
    tenantId,
    title: "Ngày đoàn viên 2026",
    description: "Những khoảnh khắc sum họp và trao thưởng khuyến học.",
    imageCount: 28,
    status: "published"
  },
  {
    id: "album-2",
    tenantId,
    title: "Tư liệu nhà thờ tộc",
    description: "Ảnh tư liệu kiến trúc, hoành phi và gia bảo.",
    imageCount: 17,
    status: "published"
  },
  {
    id: "album-3",
    tenantId,
    title: "Ký ức qua các thế hệ",
    description: "Ảnh chân dung được con cháu sưu tầm và chú thích.",
    imageCount: 42,
    status: "published"
  }
];

export const demoSnapshot: TenantSnapshot = {
  tenant: demoTenant,
  tree: demoTree,
  subscription: {
    planId: "community",
    status: "active",
    startsAt: "2026-06-01T00:00:00.000Z",
    expiresAt: "2027-06-01T00:00:00.000Z"
  },
  posts,
  events,
  albums
};
