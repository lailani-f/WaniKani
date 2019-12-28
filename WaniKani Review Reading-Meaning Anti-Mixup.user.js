// ==UserScript==
// @name         WaniKani Review Reading/Meaning Anti-Mixup
// @namespace    wk_lai
// @version      1.0
// @description  Second chance script for mixing up readings and meanings
// @author       lai
// @match        *://www.wanikani.com/review/session
// @grant        none
// ==/UserScript==

// Bind jQuery event handlers before others
// Source: https://stackoverflow.com/a/6152570/10347253
(function($) {
    $.fn.bindFirst = function(/*String*/ eventType, /*[Object]*/ eventData, /*Function*/ handler) {
        var indexOfDot = eventType.indexOf(".");
        var eventNameSpace = indexOfDot > 0 ? eventType.substring(indexOfDot) : "";

        eventType = indexOfDot > 0 ? eventType.substring(0, indexOfDot) : eventType;
        handler = handler == undefined ? eventData : handler;
        eventData = typeof eventData == "function" ? {} : eventData;

        return this.each(function() {
            var $this = $(this);
            var currentAttrListener = this["on" + eventType];

            if (currentAttrListener) {
                $this.bind(eventType, function(e) {
                    return currentAttrListener(e.originalEvent);
                });

                this["on" + eventType] = null;
            }

            $this.bind(eventType + eventNameSpace, eventData, handler);

            var allEvents = $this.data("events") || $._data($this[0], "events");
            var typeEvents = allEvents[eventType];
            var newEvent = typeEvents.pop();
            typeEvents.unshift(newEvent);
        });
    };
})(window.jQuery);

(({ jQuery: $, wanakana, answerChecker }) => {

    const ReverseAnswer = function(type, answer) { this.reverseType = type; this.reverseAnswer = answer; };

    const evaluate = (type, input) => {
        // ... and revert side effects
        const formValue = $("#user-response").val();
        const result = answerChecker.evaluate(type, input);
        $("#user-response").val(formValue);
        return result;
    };

    const answerSubmitHandler = (e) => {
        const $response = $("#user-response");
        if ( $response.is(":disabled") ) return;

        const $button = $("#answer-form button");
        const $form = $("#answer-form form");
        const questionType = $.jStorage.get("questionType");
        const answer = $response.val();
        const result = evaluate(questionType, answer);
        if (result.passed) return;

        const { reverseType, reverseAnswer } = reverseInput( questionType, answer );
        const reverseResult = evaluate(reverseType, reverseAnswer);
        if (!reverseResult.passed) return;

        e.preventDefault();
        e.stopImmediatePropagation();
        $form.append( $('<div id="answer-exception" class="answer-exception-form"><span>WaniKani would like to humbly remind you that it is looking for the ' + questionType + "</span></div>").addClass("animated fadeInUp") );
    };

    const reverseInput = (type, answer) => {
        switch (type){
            case "meaning":
                return new ReverseAnswer("reading", wanakana.toKana(answer) );
            case "reading":
                return new ReverseAnswer("meaning", wanakana.toRomaji(answer) );
        }
    };

    // set up
    $("#answer-form button").bindFirst("click", answerSubmitHandler);

})(window);