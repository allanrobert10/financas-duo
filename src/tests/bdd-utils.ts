// Utilitário BDD com suporte a Allure (ou console fallback)
import * as allure from 'allure-js-commons'

// Tenta usar a instância global ou runtime se disponível via allure-vitest
// Mas como allure-vitest injeta, vamos usar console.log se falhar

export async function Funcionalidade(nome: string, fn: () => void | Promise<void>) {
    console.log(`\n📚 Funcionalidade: ${nome}`)
    await fn()
}

export async function Cenario(nome: string, fn: () => void | Promise<void>) {
    console.log(`\n🧩 Cenário: ${nome}`)
    // Se allure estiver disponível no global/contexto
    await fn()
}

export async function Dado(descricao: string, fn: () => void | Promise<void>) {
    console.log(`  📍 Dado ${descricao}`)
    try {
        // Tenta usar allure.step se possível, mas allure-js-commons precisa de runtime
        // Simplificando: apenas executa e loga
        await fn()
    } catch (e) {
        throw e
    }
}

export async function Quando(descricao: string, fn: () => void | Promise<void>) {
    console.log(`  ⚡ Quando ${descricao}`)
    await fn()
}

export async function Entao(descricao: string, fn: () => void | Promise<void>) {
    console.log(`  ✅ Então ${descricao}`)
    await fn()
}

export async function TirarScreenshot(nome: string = 'Snapshot') {
    // Em jsdom não tem screenshot real, apenas HTML dump
    // Se allure estiver configurado, poderíamos usar:
    // allure.attachment(nome, document.body.innerHTML, 'text/html')
    // Mas sem a instância runtime correta, deixamos quieto ou logamos
    console.log(`  📸 [Snapshot HTML] ${nome}`)
}
