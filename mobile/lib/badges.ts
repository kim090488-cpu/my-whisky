export type BadgeMeta = { label: string; emoji: string; description: string };

export const BADGE_META: Record<string, BadgeMeta> = {
  first_note:            { emoji: "🥃", label: "첫 노트",       description: "테이스팅 노트 1개 작성" },
  ten_notes:             { emoji: "📝", label: "10 노트",        description: "테이스팅 노트 10개 작성" },
  fifty_notes:           { emoji: "🏆", label: "50 노트",        description: "테이스팅 노트 50개 작성" },
  century_notes:         { emoji: "👑", label: "100 노트",       description: "테이스팅 노트 100개 작성" },
  first_follower:        { emoji: "❤️", label: "첫 팔로워",     description: "첫 팔로워 획득" },
  ten_followers:         { emoji: "⭐", label: "10 팔로워",     description: "팔로워 10명 달성" },
  first_moment:          { emoji: "📷", label: "첫 모먼트",     description: "모먼트 1개 등록" },
  ten_moments:           { emoji: "📸", label: "10 모먼트",     description: "모먼트 10개 등록" },
  first_collection:      { emoji: "📦", label: "첫 컬렉션",     description: "컬렉션 첫 등록" },
  collector_ten:         { emoji: "🏛", label: "컬렉터",         description: "컬렉션 10개 달성" },
  first_community_post:  { emoji: "💬", label: "첫 게시글",     description: "커뮤니티 첫 게시글" },
  community_regular:     { emoji: "🗣", label: "활동가",         description: "커뮤니티 게시글 5개" },
  first_edit:            { emoji: "✏️", label: "첫 편집",       description: "위스키 정보 수정 참여" },
  curator_ten:           { emoji: "🎨", label: "큐레이터",       description: "위스키 편집 10회" },
};
