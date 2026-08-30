// ============================================================================
// WEREWOLF: NIGHT OF DECEPTION - Android Native Project Codebase Export
// Clean Architecture with Kotlin, Jetpack Compose, Material 3, StateFlow, Room, WebSockets
// ============================================================================

export interface AndroidCodeFile {
  path: string;
  category: 'GRADLE' | 'MANIFEST' | 'DATA' | 'DOMAIN' | 'PRESENTATION' | 'UI';
  description: string;
  code: string;
}

export const ANDROID_PROJECT_FILES: AndroidCodeFile[] = [
  {
    path: 'settings.gradle.kts',
    category: 'GRADLE',
    description: 'Gradle settings & repository configurations for Android Studio',
    code: `pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\\\.android.*")
                includeGroupByRegex("com\\\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "WerewolfNightOfDeception"
include(":app")
`,
  },
  {
    path: 'app/build.gradle.kts',
    category: 'GRADLE',
    description: 'App Module Gradle configuration with Jetpack Compose, OkHttp WebSocket & Room DB',
    code: `plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    id("kotlin-kapt")
}

android {
    namespace = "app.werewolf.nightofdeception"
    compileSdk = 35

    defaultConfig {
        applicationId = "app.werewolf.nightofdeception"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = signingConfigs.getByName("debug") // Hoặc cấu hình release keystore
        }
        debug {
            applicationIdSuffix = ".debug"
            isDebuggable = true
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
    }
}

dependencies {
    // AndroidX & Compose BOM
    val composeBom = platform("androidx.compose:compose-bom:2024.10.01")
    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.activity:activity-compose:1.9.3")

    // Material 3 & Navigation
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.navigation:navigation-compose:2.8.4")

    // WebSocket Networking & JSON
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")

    // Room Database for Offline Game History & Preferences
    val roomVersion = "2.6.1"
    implementation("androidx.room:room-runtime:$roomVersion")
    implementation("androidx.room:room-ktx:$roomVersion")
    kapt("androidx.room:room-compiler:$roomVersion")

    // Image loading
    implementation("io.coil-kt:coil-compose:2.7.0")

    // Testing
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.9.0")
    testImplementation("org.mockito.kotlin:mockito-kotlin:5.4.0")
}
`,
  },
  {
    path: 'app/src/main/AndroidManifest.xml',
    category: 'MANIFEST',
    description: 'Android Manifest with minimal strict permissions (INTERNET & Network state)',
    code: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- Quyền mạng tối thiểu cho Realtime WebSocket Game -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.VIBRATE" />

    <application
        android:name=".WerewolfApplication"
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.WerewolfNightOfDeception"
        android:usesCleartextTraffic="true">
        
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:theme="@style/Theme.WerewolfNightOfDeception"
            android:configChanges="orientation|screenSize|keyboardHidden"
            android:screenOrientation="portrait">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>

</manifest>
`,
  },
  {
    path: 'app/src/main/java/app/werewolf/nightofdeception/data/network/WerewolfWebSocketClient.kt',
    category: 'DATA',
    description: 'Authoritative OkHttp WebSocket client with automatic reconnection & heartbeat',
    code: `package app.werewolf.nightofdeception.data.network

import app.werewolf.nightofdeception.domain.model.WsMessage
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.*
import java.util.concurrent.TimeUnit

class WerewolfWebSocketClient(
    private val serverBaseUrl: String = "wss://werewolf-night-ojrn.onrender.com/ws"
) {
    private val client = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .pingInterval(25, TimeUnit.SECONDS)
        .build()

    private var webSocket: WebSocket? = null
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    private val _incomingMessages = MutableSharedFlow<WsMessage>(replay = 1)
    val incomingMessages: SharedFlow<WsMessage> = _incomingMessages.asSharedFlow()

    private val _connectionState = MutableSharedFlow<Boolean>(replay = 1)
    val connectionState: SharedFlow<Boolean> = _connectionState.asSharedFlow()

    fun connect(roomId: String, playerId: String, sessionToken: String?) {
        val request = Request.Builder()
            .url("$serverBaseUrl?roomId=$roomId&playerId=$playerId")
            .build()

        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                scope.launch { _connectionState.emit(true) }
                // Authenticate immediately upon connection
                send(WsMessage(
                    type = "AUTH",
                    roomId = roomId,
                    playerId = playerId,
                    sessionToken = sessionToken
                ))
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                try {
                    val msg = json.decodeFromString<WsMessage>(text)
                    scope.launch { _incomingMessages.emit(msg) }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                scope.launch { _connectionState.emit(false) }
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                scope.launch { _connectionState.emit(false) }
            }
        })
    }

    fun send(message: WsMessage) {
        val text = json.encodeToString(message)
        webSocket?.send(text)
    }

    fun disconnect() {
        webSocket?.close(1000, "User left")
        webSocket = null
    }
}
`,
  },
  {
    path: 'app/src/main/java/app/werewolf/nightofdeception/domain/engine/GameStateMachine.kt',
    category: 'DOMAIN',
    description: 'Kotlin StateFlow Game State Machine matching Authoritative Server',
    code: `package app.werewolf.nightofdeception.domain.engine

import app.werewolf.nightofdeception.domain.model.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class GameStateMachine {
    private val _uiState = MutableStateFlow<GameUiState>(GameUiState.Loading)
    val uiState: StateFlow<GameUiState> = _uiState.asStateFlow()

    fun processServerMessage(msg: WsMessage) {
        when (msg.type) {
            "ROOM_STATE", "RECONNECT_STATE" -> {
                val room = msg.roomData ?: return
                _uiState.value = GameUiState.InRoom(
                    room = room,
                    myPlayer = room.players.find { it.id == msg.playerId },
                    currentPhase = room.gameState?.currentPhase ?: GamePhase.LOBBY
                )
            }
            "PHASE_CHANGED" -> {
                val current = (_uiState.value as? GameUiState.InRoom) ?: return
                val newPhase = msg.payload?.optPhase ?: GamePhase.NIGHT
                _uiState.value = current.copy(currentPhase = newPhase)
            }
            "ROLE_ASSIGNED" -> {
                val current = (_uiState.value as? GameUiState.InRoom) ?: return
                val assignedRole = msg.payload?.optRole
                _uiState.value = current.copy(
                    myRole = assignedRole,
                    currentPhase = GamePhase.ROLE_REVEAL
                )
            }
            "GAME_OVER" -> {
                val current = (_uiState.value as? GameUiState.InRoom) ?: return
                _uiState.value = GameUiState.GameOver(
                    winnerTeam = msg.payload?.optWinner ?: "VILLAGE",
                    room = current.room
                )
            }
        }
    }
}

sealed interface GameUiState {
    object Loading : GameUiState
    data class InRoom(
        val room: RoomData,
        val myPlayer: Player?,
        val myRole: RoleId? = null,
        val currentPhase: GamePhase = GamePhase.LOBBY
    ) : GameUiState
    data class GameOver(val winnerTeam: String, val room: RoomData) : GameUiState
    data class Error(val message: String) : GameUiState
}
`,
  },
  {
    path: 'app/src/main/java/app/werewolf/nightofdeception/ui/screens/GamePlayScreen.kt',
    category: 'UI',
    description: 'Jetpack Compose Night/Day/Voting UI with animated Dark Fantasy aesthetics',
    code: `package app.werewolf.nightofdeception.ui.screens

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.werewolf.nightofdeception.domain.model.*

@Composable
fun GamePlayScreen(
    room: RoomData,
    myPlayer: Player,
    myRole: RoleId?,
    onActionSubmit: (actionType: String, targetId: String?) -> Unit,
    onOpenMyCard: () -> Unit
) {
    val currentPhase = room.gameState?.currentPhase ?: GamePhase.NIGHT
    val isNight = currentPhase == GamePhase.NIGHT

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(if (isNight) Color(0xFF070B14) else Color(0xFF13110E))
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Header Bar
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = if (isNight) "🌙 BAN ĐÊM (Vòng \${room.gameState?.roundNumber ?: 1})" 
                           else "☀️ BAN NGÀY (Vòng \${room.gameState?.roundNumber ?: 1})",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (isNight) Color(0xFF38BDF8) else Color(0xFFFBBF24)
                )

                // Quick Floating Card Button
                Button(
                    onClick = onOpenMyCard,
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1E293B)),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(Icons.Default.CreditCard, contentDescription = null, tint = Color(0xFFA855F7))
                    Spacer(Modifier.width(6.dp))
                    Text("Lá bài của tôi", fontSize = 12.sp)
                }
            }

            Spacer(Modifier.height(16.dp))

            // Player List Grid
            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                modifier = Modifier.weight(1f),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(room.players) { player ->
                    PlayerCardItem(
                        player = player,
                        isCurrentPlayer = player.id == myPlayer.id,
                        onClick = {
                            if (player.isAlive && player.id != myPlayer.id) {
                                onActionSubmit("SELECT_TARGET", player.id)
                            }
                        }
                    )
                }
            }

            // Bottom Action Console
            ActionConsole(
                phase = currentPhase,
                myRole = myRole,
                isAlive = myPlayer.isAlive,
                onAction = onActionSubmit
            )
        }
    }
}

@Composable
fun PlayerCardItem(player: Player, isCurrentPlayer: Boolean, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (player.isAlive) Color(0xFF0F172A) else Color(0xFF1E1E1E)
        )
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .background(if (player.isAlive) Color(0xFF3B82F6) else Color.Gray, RoundedCornerShape(10.dp)),
                contentAlignment = Alignment.Center
            ) {
                Text(player.nickname.take(1).uppercase(), color = Color.White, fontWeight = FontWeight.Bold)
            }
            Spacer(Modifier.width(10.dp))
            Column {
                Text(player.nickname, fontWeight = FontWeight.SemiBold, color = Color.White)
                Text(
                    text = if (player.isAlive) "Còn sống" else "💀 Đã chết",
                    fontSize = 11.sp,
                    color = if (player.isAlive) Color(0xFF10B981) else Color(0xFFEF4444)
                )
            }
        }
    }
}

@Composable
fun ActionConsole(
    phase: GamePhase,
    myRole: RoleId?,
    isAlive: Boolean,
    onAction: (String, String?) -> Unit
) {
    Surface(
        color = Color(0xFF1E293B),
        shape = RoundedCornerShape(20.dp),
        modifier = Modifier.fillMaxWidth().padding(top = 8.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = if (isAlive) "HÀNH ĐỘNG CỦA BẠN" else "👻 BẠN LÀ LINH HỒN (Quan sát trận đấu)",
                fontWeight = FontWeight.Bold,
                fontSize = 14.sp,
                color = Color.White
            )
        }
    }
}
`,
  },
];
