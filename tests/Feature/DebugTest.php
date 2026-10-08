<?php

namespace Tests\Feature;

use Tests\TestCase;

class DebugTest extends TestCase
{
    public function test_debug_root(): void
    {
        $this->withoutExceptionHandling();
        try {
            $response = $this->get('/');
            dump($response->getStatusCode());
        } catch (\Throwable $e) {
            dump(get_class($e));
            dump($e->getMessage());
            dump($e->getFile() . ':' . $e->getLine());
        }
        $this->assertTrue(true);
    }
}
