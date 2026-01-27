-- Insert initial products (친환경 굿즈 6종)
INSERT OR IGNORE INTO products (id, name, description, price, image_url, category, stock) VALUES 
  (1, '스테인리스 텀블러', '이중 진공 단열 구조로 온도를 오래 유지하는 친환경 텀블러입니다. 일회용 컵 사용을 줄이고 바다를 지켜주세요.', 25000, '/static/images/products/tumbler.jpg', 'eco-goods', 100),
  (2, '유기농 에코백', '재생 면으로 만든 튼튼한 에코백입니다. 비닐봉지 대신 사용하여 해양 쓰레기를 줄여주세요.', 15000, '/static/images/products/ecobag.jpg', 'eco-goods', 150),
  (3, '대나무 칫솔 세트', '100% 천연 대나무로 만든 칫솔 3개 세트입니다. 플라스틱 칫솔을 대체하여 환경을 보호합니다.', 12000, '/static/images/products/toothbrush.jpg', 'eco-goods', 200),
  (4, '천연 비누 세트', '화학 성분 없는 천연 비누 4개 세트입니다. 수질 오염을 줄이고 바다 생태계를 지킵니다.', 18000, '/static/images/products/soap.jpg', 'eco-goods', 120),
  (5, '리사이클 모자', '재활용 섬유로 만든 편안한 모자입니다. OCEVAVE 로고가 새겨진 특별한 디자인입니다.', 22000, '/static/images/products/cap.jpg', 'eco-goods', 80),
  (6, '방수 스티커 세트', '재활용 가능한 소재로 만든 스티커 10종 세트입니다. 환경 보호 메시지를 전파하세요.', 8000, '/static/images/products/sticker.jpg', 'eco-goods', 300);

-- Insert initial events (이벤트 가상 데이터)
INSERT OR IGNORE INTO events (id, title, content, image_url, event_date, location) VALUES
  (1, '해양 정화의 날 2024', '제주 해안가에서 진행되는 대규모 해양 정화 활동입니다. 자원봉사자 여러분의 많은 참여 부탁드립니다. 수거된 쓰레기는 적절히 분류하여 재활용하며, 참가자 전원에게 친환경 굿즈를 제공합니다.', '/static/images/events/cleanup.jpg', '2024-06-15', '제주도 협재해수욕장'),
  (2, '바다 생태계 보호 세미나', '해양 생물학자와 환경 전문가가 함께하는 특별 세미나입니다. 해양 생태계의 중요성과 보호 방법을 배우는 귀중한 시간이 될 것입니다.', '/static/images/events/seminar.jpg', '2024-07-20', '서울 코엑스 컨퍼런스룸'),
  (3, '어린이 환경 교육 프로그램', '초등학생을 대상으로 한 해양 환경 교육 프로그램입니다. 재미있는 체험 활동과 함께 환경 보호의 중요성을 배웁니다.', '/static/images/events/education.jpg', '2024-08-10', '부산 해양박물관'),
  (4, 'OCEVAVE 창립 기념 특별전', '1주년을 맞이하여 그동안의 활동과 성과를 공유하는 특별 전시회를 개최합니다. 사진과 영상으로 만나는 우리의 여정.', '/static/images/events/anniversary.jpg', '2024-09-01', 'OCEVAVE 본사 갤러리');

-- Insert initial activities (활동 가상 데이터)
INSERT OR IGNORE INTO activities (id, title, content, image_url, activity_date, location) VALUES
  (1, '제1회 해안 쓰레기 수거 활동', '100명의 자원봉사자가 함께 동해안 해변을 정화했습니다. 총 500kg의 쓰레기를 수거하여 바다를 깨끗하게 만들었습니다. 수거한 쓰레기는 분류하여 재활용 센터로 보냈습니다.', '/static/images/activities/cleanup1.jpg', '2024-03-15', '강릉 경포해변'),
  (2, '산호초 보호 캠페인', '제주도 바다에서 산호초 보호 활동을 진행했습니다. 해양 생물학자와 함께 산호초 상태를 모니터링하고 보호 방안을 논의했습니다.', '/static/images/activities/coral.jpg', '2024-04-20', '제주도 서귀포 앞바다'),
  (3, '플라스틱 프리 챌린지', '한 달간 일회용 플라스틱 사용을 줄이는 챌린지를 진행했습니다. 500명이 참여하여 약 2톤의 플라스틱 사용을 줄였습니다.', '/static/images/activities/plastic-free.jpg', '2024-05-01', '전국 온라인 캠페인'),
  (4, '해양 생태계 다큐멘터리 제작', '해양 오염의 심각성을 알리는 다큐멘터리를 제작했습니다. 유튜브와 SNS를 통해 10만 명 이상이 시청했습니다.', '/static/images/activities/documentary.jpg', '2024-05-15', '온라인 공개');
