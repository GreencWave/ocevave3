-- Create company_info table for editable company information
CREATE TABLE IF NOT EXISTS company_info (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section TEXT NOT NULL UNIQUE,
  title TEXT,
  content TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default company info
INSERT OR IGNORE INTO company_info (section, title, content) VALUES
('mission', '우리의 미션', 'OCEVAVE는 "바다의 미래를 다시 씁니다"라는 슬로건 아래, 해양 환경 보호를 위한 실질적인 행동을 이끄는 기업입니다.'),
('vision', '비전', 'OCEVAVE는 깨끗한 바다, 건강한 생태계를 다음 세대에 물려주기 위해 노력합니다.'),
('value1', '환경 보호', '지구가 주신 바다를 소중히 여기고, 다음 세대에 깨끗한 환경을 물려주기 위해 노력합니다.'),
('value2', '책임 있는 소비', '친환경 제품을 통해 지속 가능한 소비 문화를 만들며, 모든 구매가 바다를 지키는 행동이 되도록 합니다.'),
('value3', '창조세계 보전', '자연과 인간이 조화롭게 공존하는 세상을 꿈꾸며, 모든 생명을 존중하고 보호합니다.');
