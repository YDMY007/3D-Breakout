# -*- coding: utf-8 -*-
"""
把物理 Worker(8a1e2263_v11)的 autoStick 补丁镜像移植到主线程物理模块(025d33d0)。
背景:引擎在安卓上写死走主线程物理(webgl bundle: os==="android" -> ex() -> 025d33d0),
补丁原来只在 worker 文件里,导致手机端终极作弊(自动吸附)无效。

同时执行版本号改名链(cache-busting 约定):
  025d33d0_v3e -> _v4 (内容补丁 + import 路径)
  webgl _v7    -> _v8 (ex() 引用 025d33d0_v4 / vendor_v9 / main_v8)
  vendor _v8   -> _v9 (import webgl_v8 + 预加载数组)
  main   _v7   -> _v8 (import vendor_v9)
  index.html   (modulepreload / script src)
每个替换都断言恰好命中一次,任何失配立即报错退出。
"""
import io, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB = os.path.join(ROOT, "web", "assets")
IDX = os.path.join(ROOT, "web", "index.html")

def read(p):
    with io.open(p, "r", encoding="utf-8") as f: return f.read()

def write(p, s):
    with io.open(p, "w", encoding="utf-8", newline="") as f: f.write(s)

def sub1(s, old, new, tag):
    n = s.count(old)
    assert n == 1, "[{tag}] 期望恰好 1 处,实际 {n}: {old[:80]}...".format(tag=tag, n=n, old=old)
    return s.replace(old, new, 1)

# ---------- 1) 025d33d0_v3e -> _v4 ----------
s = read(os.path.join(WEB, "PhysicsWorker.025d33d011ae33ec_v3e.js"))
T = "025d33d0"

# 1a. bounceWall 开头插入 sticky||autoStick 接球分支(镜像 worker v11)
old = "bounceWall(t,i,o,s){const e=t.side,n=this.physics.bonuses.futureproof,h=!n&&e.isTop;let r=!1;"
new = ("bounceWall(t,i,o,s){const e=t.side,n=this.physics.bonuses.futureproof,h=!n&&e.isTop;"
       "let sk=this.physics.bonuses.sticky||this.physics.autoStick;"
       "if(sk&&e.isTop){s.y=Math.abs(s.y),this.physics.autoStick&&(s.x+=(Math.random()-.5)*.3),"
       "this.queue(b.UpdateBallState,[2]);this.avoidBounceLock(t.box,s),this.clampDirectionAngle(s);return}"
       "let r=!1;")
s = sub1(s, old, new, T + "/bounceWall")

# 1b. 底部落球救援:还有砖且 autoStick 时粘回挡板,否则照原样隐藏
old = ("!s&&i.y>1&&(this.visible=!1,this.state=g.Hidden,this.lastWasBottomWall=!1,"
       "this.queue(b.OnLimitCollision,[i.x,i.y]))")
new = ("!s&&i.y>1&&this.physics.blocks.size>0&&(this.physics.autoStick?"
       "(this.stickToBar(),this.queue(b.UpdateBallState,[1])):"
       "(this.visible=!1,this.state=g.Hidden,this.lastWasBottomWall=!1,"
       "this.queue(b.OnLimitCollision,[i.x,i.y])))")
s = sub1(s, old, new, T + "/fallout")

# 1c. 挡板随球微调(每帧,球下落且未到板线以下)
old = ")}updateActive(t){this.visi"
assert s.count(old) == 1, "[025d33d0] updateActive 锚点不唯一"
new = (")}updateActive(t){"
       "if(this.physics.autoStick&&this.physics.bar&&this.physics.bar.position&&this.direction.y>0&&this.position.y>-3)"
       "try{var _b2=this.physics.bar.position;"
       "_b2.x+=Math.max(-.28,Math.min(.28,this.position.x-_b2.x))}catch(_e){}"
       "this.visi")
s = sub1(s, old, new, T + "/barfollow")

# 1d. 物理类构造器补字段(setConfiguration 的 i in this 检查要求字段先存在)
old = "this.levelWidth=0,this.levelCenter=0"
assert s.count(old) == 1, "[025d33d0] 构造器锚点不唯一"
s = sub1(s, old, "this.autoStick=!1," + old, T + "/field")

# 1e. setConfiguration:读写 __dzkAutoStick 全局,关卡重发配置时回填(镜像 worker v11)
old = 'setConfiguration(t){for(let i in t)i in this&&(this[i]=t[i]);'
new = ('setConfiguration(t){if("autoStick"in t)self.__dzkAutoStick=!!t.autoStick;'
       'else if(typeof self.__dzkAutoStick!=="undefined"&&"autoStick"in this)t.autoStick=self.__dzkAutoStick;'
       'for(let i in t)i in this&&(this[i]=t[i]);')
s = sub1(s, old, new, T + "/setcfg")

# 1f. import 路径升级
s = sub1(s, 'from"./webgl.c47c235111ae33ec_v7.js"', 'from"./webgl.c47c235111ae33ec_v8.js"', T + "/imp-webgl")
s = sub1(s, 'from"./vendor.4d25231d11ae33ec_v8.js"', 'from"./vendor.4d25231d11ae33ec_v9.js"', T + "/imp-vendor")
s = sub1(s, 'import"./main.fb1695dd11ae33ec_v7.js"', 'import"./main.fb1695dd11ae33ec_v8.js"', T + "/imp-main")

write(os.path.join(WEB, "PhysicsWorker.025d33d011ae33ec_v4.js"), s)

# ---------- 2) webgl _v7 -> _v8 ----------
s = read(os.path.join(WEB, "webgl.c47c235111ae33ec_v7.js"))
W = "webgl"
old = 'const ex=()=>Ic(()=>import("./PhysicsWorker.025d33d011ae33ec_v3e.js"),["assets/PhysicsWorker.025d33d011ae33ec_v3e.js","assets/vendor.4d25231d11ae33ec_v8.js","assets/vendor.605820b411ae33ec.css","assets/main.fb1695dd11ae33ec_v7.js","assets/main.4a98444b11ae33ec.css"])'
new = 'const ex=()=>Ic(()=>import("./PhysicsWorker.025d33d011ae33ec_v4.js"),["assets/PhysicsWorker.025d33d011ae33ec_v4.js","assets/vendor.4d25231d11ae33ec_v9.js","assets/vendor.605820b411ae33ec.css","assets/main.fb1695dd11ae33ec_v8.js","assets/main.4a98444b11ae33ec.css"])'
s = sub1(s, old, new, W + "/ex")
s = sub1(s, 'from"./vendor.4d25231d11ae33ec_v8.js"', 'from"./vendor.4d25231d11ae33ec_v9.js"', W + "/imp-vendor")
s = sub1(s, 'from"./main.fb1695dd11ae33ec_v7.js"', 'from"./main.fb1695dd11ae33ec_v8.js"', W + "/imp-main")
write(os.path.join(WEB, "webgl.c47c235111ae33ec_v8.js"), s)

# ---------- 3) vendor _v8 -> _v9 ----------
s = read(os.path.join(WEB, "vendor.4d25231d11ae33ec_v8.js"))
V = "vendor"
old = 'const f4=l4(()=>import("./webgl.c47c235111ae33ec_v7.js").then(function(e)'
s = sub1(s, old, old.replace("webgl.c47c235111ae33ec_v7", "webgl.c47c235111ae33ec_v8"), V + "/imp")
old2 = '),["assets/webgl.c47c235111ae33ec_v7.js","assets/main.fb1695dd11ae33ec_v7.js","assets/main.4a98444b11ae33ec.css"])'
new2 = '),["assets/webgl.c47c235111ae33ec_v8.js","assets/main.fb1695dd11ae33ec_v8.js","assets/main.4a98444b11ae33ec.css"])'
s = sub1(s, old2, new2, V + "/preload")
write(os.path.join(WEB, "vendor.4d25231d11ae33ec_v9.js"), s)

# ---------- 4) main _v7 -> _v8 ----------
s = read(os.path.join(WEB, "main.fb1695dd11ae33ec_v7.js"))
s = sub1(s, 'from"./vendor.4d25231d11ae33ec_v8.js"', 'from"./vendor.4d25231d11ae33ec_v9.js"', "main/imp")
write(os.path.join(WEB, "main.fb1695dd11ae33ec_v8.js"), s)

# ---------- 5) index.html 引用 ----------
s = read(IDX)
s = sub1(s, 'href="./assets/main.fb1695dd11ae33ec_v7.js"', 'href="./assets/main.fb1695dd11ae33ec_v8.js"', "idx/pre-main")
s = sub1(s, 'href="./assets/webgl.c47c235111ae33ec_v7.js"', 'href="./assets/webgl.c47c235111ae33ec_v8.js"', "idx/pre-webgl")
s = sub1(s, 'src="./assets/main.fb1695dd11ae33ec_v7.js"', 'src="./assets/main.fb1695dd11ae33ec_v8.js"', "idx/src-main")
write(IDX, s)

print("OK: 025d33d0_v4 / webgl_v8 / vendor_v9 / main_v8 / index.html 全部生成,断言全部通过")
